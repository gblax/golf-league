// Fix script: Repair migrated Supabase Auth users with missing identities/provider
//
// This deletes and re-creates each auth user so that Supabase properly
// populates the identities table with the "email" provider.
//
// Usage:
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/fix-auth-identities.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const TEMP_PASSWORD = process.env.TEMP_PASSWORD || 'ChangeMe123!';

async function fix() {
  // Fetch all users from the app's users table
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, email, name');

  if (error) {
    console.error('Failed to fetch users:', error.message);
    process.exit(1);
  }

  console.log(`Found ${users.length} users to fix.\n`);

  let fixed = 0;
  let failed = 0;

  for (const user of users) {
    console.log(`Processing: ${user.email}...`);

    // Delete the existing broken auth user
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error(`  FAIL delete: ${deleteError.message}`);
      failed++;
      continue;
    }

    // Re-create with proper provider identity
    const { data, error: createError } = await supabase.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password: TEMP_PASSWORD,
      email_confirm: true,
      user_metadata: { name: user.name },
      app_metadata: { provider: 'email', providers: ['email'] },
    });

    if (createError) {
      console.error(`  FAIL create: ${createError.message}`);
      failed++;
    } else {
      console.log(`  OK: re-created ${user.email} (${data.user.id})`);
      fixed++;
    }
  }

  console.log(`\nDone. Fixed: ${fixed}, Failed: ${failed}`);
  console.log(`\nUsers can sign in with password: "${TEMP_PASSWORD}"`);
}

fix();
