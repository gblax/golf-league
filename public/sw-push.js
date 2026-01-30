// Push notification event handler
// This file is imported by the main service worker

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'Golf League',
      body: event.data.text(),
      icon: '/icon-192.png',
      badge: '/icon-192.png'
    };
  }

  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    data: {
      url: data.url || '/'
    },
    vibrate: [200, 100, 200],
    tag: data.tag || 'golf-league-notification',
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Golf League', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      return clients.openWindow(url);
    })
  );
});
