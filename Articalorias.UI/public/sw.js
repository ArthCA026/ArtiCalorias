/**
 * Only same-origin paths may be opened from a notification. The server
 * currently always sends "/", but a push payload is data from outside the
 * page, and a notification click is a trusted gesture: an absolute URL to
 * another site would turn the installed app into a phishing launcher.
 */
function safeTargetUrl(candidate) {
  try {
    const url = new URL(candidate ?? '/', self.location.origin);
    return url.origin === self.location.origin ? url.href : self.location.origin + '/';
  } catch (_) {
    return self.location.origin + '/';
  }
}

self.addEventListener('push', (event) => {
  let data = { title: 'ArtiCalorias', body: '' };
  try {
    data = event.data?.json() ?? data;
  } catch (_) {
    // Malformed payload: show the neutral default rather than nothing.
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(String(data.title ?? 'ArtiCalorias'), {
        body: String(data.body ?? ''),
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: String(data.tag ?? 'articalorias-reminder'),
        data: { url: safeTargetUrl(data.url) },
      }),
      'setAppBadge' in self.navigator
        ? self.navigator.setAppBadge(1)
        : Promise.resolve(),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = safeTargetUrl(event.notification.data?.url);

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        const existing = windowClients.find(
          (c) => c.url.startsWith(self.location.origin) && 'focus' in c
        );
        if (existing) return existing.focus();
        return clients.openWindow(targetUrl);
      })
  );
});
