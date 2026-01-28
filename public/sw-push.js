/**
 * Push Notification Handler for Golf League PWA
 *
 * This file contains the push event handlers that will be injected
 * into the Workbox-generated service worker.
 */

// Handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);

  let data = {
    title: 'Golf League',
    body: 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'golf-league-notification',
    url: '/'
  };

  // Parse push data if available
  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        ...data,
        ...payload
      };
    } catch (e) {
      // If not JSON, use as body text
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || 'golf-league-notification',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now()
    },
    actions: data.actions || [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    requireInteraction: data.requireInteraction || false
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);

  event.notification.close();

  // Handle action buttons
  if (event.action === 'dismiss') {
    return;
  }

  // Get the URL to open (default to root)
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if app is already open
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Navigate to the URL and focus
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // If not open, open a new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle notification close (for analytics if needed)
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event);
});
