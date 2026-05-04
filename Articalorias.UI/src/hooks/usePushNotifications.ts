import { useState, useEffect, useCallback } from 'react';
import { pushService } from '@/services/pushService';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length) as Uint8Array<ArrayBuffer>;
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : 'denied'
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentSub, setCurrentSub] = useState<PushSubscription | null>(null);

  // Register the SW and check for an existing subscription on mount
  useEffect(() => {
    if (!supported) return;

    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        setCurrentSub(sub);
        setSubscribed(true);
      }
    });
  }, [supported]);

  const subscribe = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return;

      const reg = await navigator.serviceWorker.ready;
      const { data } = await pushService.getVapidPublicKey();

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });

      const keys = sub.toJSON().keys!;
      await pushService.subscribe({
        endpoint: sub.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      });

      setCurrentSub(sub);
      setSubscribed(true);
    } finally {
      setLoading(false);
    }
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    if (!currentSub) return;
    setLoading(true);
    try {
      const keys = currentSub.toJSON().keys!;
      await pushService.unsubscribe({
        endpoint: currentSub.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      });
      await currentSub.unsubscribe();
      setCurrentSub(null);
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, [currentSub]);

  return { supported, permission, subscribed, loading, subscribe, unsubscribe };
}
