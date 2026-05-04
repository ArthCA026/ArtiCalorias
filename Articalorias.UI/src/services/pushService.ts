import api from './api';

interface PushSubscriptionPayload {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export const pushService = {
  getVapidPublicKey() {
    return api.get<{ publicKey: string }>('/pushnotification/vapid-public-key');
  },

  subscribe(data: PushSubscriptionPayload) {
    return api.post('/pushnotification/subscribe', data);
  },

  unsubscribe(data: PushSubscriptionPayload) {
    return api.delete('/pushnotification/unsubscribe', { data });
  },
};
