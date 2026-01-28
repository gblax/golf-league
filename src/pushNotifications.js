/**
 * Push Notification Utilities for Golf League PWA
 *
 * Handles subscription management, permission requests, and Supabase sync.
 * Uses the Web Push API (free, provided by browsers).
 */

// VAPID public key - generate your own pair and store private key in Supabase secrets
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * Check if push notifications are supported in this browser
 */
export function isPushSupported() {
  return 'serviceWorker' in navigator &&
         'PushManager' in window &&
         'Notification' in window;
}

/**
 * Get current notification permission status
 * @returns {'granted' | 'denied' | 'default' | 'unsupported'}
 */
export function getPermissionStatus() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Request notification permission from the user
 * @returns {Promise<'granted' | 'denied' | 'default'>}
 */
export async function requestPermission() {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported in this browser');
  }
  return await Notification.requestPermission();
}

/**
 * Convert a base64 string to Uint8Array (needed for VAPID key)
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribe to push notifications
 * @param {object} supabase - Supabase client instance
 * @param {string} userId - Current user's ID
 * @returns {Promise<PushSubscription>}
 */
export async function subscribeToPush(supabase, userId) {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported');
  }

  if (!VAPID_PUBLIC_KEY) {
    throw new Error('VAPID public key not configured. Add VITE_VAPID_PUBLIC_KEY to your .env file.');
  }

  // Request permission if not granted
  const permission = await requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission denied');
  }

  // Get service worker registration
  const registration = await navigator.serviceWorker.ready;

  // Check for existing subscription
  let subscription = await registration.pushManager.getSubscription();

  // If no subscription exists, create one
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true, // Required: always show notification to user
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
  }

  // Save subscription to Supabase
  const subscriptionJson = subscription.toJSON();
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      endpoint: subscriptionJson.endpoint,
      p256dh_key: subscriptionJson.keys.p256dh,
      auth_key: subscriptionJson.keys.auth,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    });

  if (error) {
    console.error('Failed to save push subscription:', error);
    throw new Error('Failed to save notification subscription');
  }

  return subscription;
}

/**
 * Unsubscribe from push notifications
 * @param {object} supabase - Supabase client instance
 * @param {string} userId - Current user's ID
 */
export async function unsubscribeFromPush(supabase, userId) {
  // Get service worker registration
  const registration = await navigator.serviceWorker.ready;

  // Get existing subscription
  const subscription = await registration.pushManager.getSubscription();

  // Unsubscribe from push
  if (subscription) {
    await subscription.unsubscribe();
  }

  // Remove from Supabase
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to remove push subscription:', error);
    throw new Error('Failed to remove notification subscription');
  }
}

/**
 * Check if user is currently subscribed to push notifications
 * @param {object} supabase - Supabase client instance
 * @param {string} userId - Current user's ID
 * @returns {Promise<boolean>}
 */
export async function isSubscribed(supabase, userId) {
  if (!isPushSupported()) return false;

  // Check browser subscription
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) return false;

  // Verify it's in Supabase too
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .single();

  return !error && data !== null;
}

/**
 * Send a test notification (for debugging)
 * This creates a local notification, not a push notification
 */
export async function sendTestNotification() {
  if (Notification.permission !== 'granted') {
    throw new Error('Notification permission not granted');
  }

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification('Golf League', {
    body: 'Notifications are working! You\'ll be reminded before pick deadlines.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'test-notification',
    vibrate: [200, 100, 200]
  });
}
