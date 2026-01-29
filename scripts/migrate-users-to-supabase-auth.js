// Migration script: Create Supabase Auth accounts for existing users
//
// This script reads all existing users from the `users` table and creates
// corresponding Supabase Auth accounts with the same UUIDs, so all foreign
// keys (picks, league_members, etc.) continue to work.
//
// Prerequisites:
//   npm install @supabase/supabase-js
//
// Usage:
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/migrate-users-to-supabase-auth.js
//
// IMPORTANT: This requires the SERVICE_ROLE_KEY (not the anon key) because
// it uses the admin API to create users with specific UUIDs.

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

// Default temporary password — users should reset via "forgot password" after migration
const TEMP_PASSWORD = process.env.TEMP_PASSWORD || 'ChangeMe123!';

async function migrate() {
  // Fetch all existing users
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, name');

  if (error) {
    console.error('Failed to fetch users:', error.message);
    process.exit(1);
  }

  console.log(`Found ${users.length} users to migrate.\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    const { data, error: createError } = await supabase.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password: TEMP_PASSWORD,
      email_confirm: true, // Skip email verification for existing users
      user_metadata: { name: user.name },
    });

    if (createError) {
      if (createError.message.includes('already been registered')) {
        console.log(`SKIP: ${user.email} (already exists in auth)`);
        skipped++;
      } else {
        console.error(`FAIL: ${user.email} — ${createError.message}`);
        failed++;
      }
    } else {
      console.log(`OK:   ${user.email} (${data.user.id})`);
      created++;
    }
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}, Failed: ${failed}`);

  if (created > 0) {
    console.log(`\nIMPORTANT: All migrated users have the temporary password "${TEMP_PASSWORD}".`);
    console.log('You should notify users to change their password after first login,');
    console.log('or use Supabase password reset emails.');
  }
}

migrate();
