self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'ArtiCalorias', body: '' };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: { url: data.url ?? '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        const targetUrl = event.notification.data?.url ?? '/';
        const existing = windowClients.find((c) => c.url.includes(targetUrl) && 'focus' in c);
        if (existing) return existing.focus();
        return clients.openWindow(targetUrl);
      })
  );
});
