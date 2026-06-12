self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'ArtiCalorias', body: '' };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: data.tag ?? 'articalorias-reminder',
        data: { url: data.url ?? '/' },
      }),
      'setAppBadge' in self.navigator
        ? self.navigator.setAppBadge(1)
        : Promise.resolve(),
    ])
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
