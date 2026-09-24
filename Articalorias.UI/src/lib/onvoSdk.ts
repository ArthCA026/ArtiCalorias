/**
 * ONVO Pay browser SDK (https://docs.onvopay.com/integrations/sdk).
 *
 * The SDK renders the card form for a subscription the API created unpaid.
 * Card details travel from the browser straight to ONVO: they never pass
 * through ArtiCalorias, which is what keeps the app out of card-data scope.
 *
 * The script is injected only when a checkout actually opens, so nobody pays
 * the download (or exposes a third-party script to their session) just for
 * using the app. There is no pinned hash on purpose: like every payment SDK,
 * ONVO ships fixes under the same URL.
 */

const ONVO_SDK_URL = 'https://sdk.onvopay.com/sdk.js';
const LOAD_TIMEOUT_MS = 15_000;

/** Card-verification detail ONVO may attach to an error. Every field is optional. */
export interface OnvoSdkError {
  message?: string;
  details?: {
    card?: {
      /** Use this for logic: "issuer_declined" | "gateway_declined" | ... */
      reason?: string;
    };
  };
}

interface OnvoPayConfig {
  publicKey: string;
  subscriptionId: string;
  paymentType: 'subscription';
  customerId?: string;
  locale?: 'es' | 'en';
  onSuccess: (data: unknown) => void;
  onError: (data: OnvoSdkError) => void;
}

interface OnvoSdk {
  pay: (config: OnvoPayConfig) => { render: (selector: string) => void };
}

declare global {
  interface Window {
    onvo?: OnvoSdk;
  }
}

let pending: Promise<OnvoSdk> | null = null;

/** Resolves with the SDK, loading it on first use. Rejects when it cannot be loaded (offline, blocked). */
export function loadOnvoSdk(): Promise<OnvoSdk> {
  if (window.onvo) return Promise.resolve(window.onvo);
  if (pending) return pending;

  pending = new Promise<OnvoSdk>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = ONVO_SDK_URL;
    script.async = true;

    const fail = () => {
      // Let the next attempt start clean: drop the dead tag and the memo.
      script.remove();
      pending = null;
      reject(new Error('onvo-sdk-unavailable'));
    };

    const timer = window.setTimeout(fail, LOAD_TIMEOUT_MS);
    script.addEventListener(
      'load',
      () => {
        window.clearTimeout(timer);
        if (window.onvo) resolve(window.onvo);
        else fail();
      },
      { once: true },
    );
    script.addEventListener(
      'error',
      () => {
        window.clearTimeout(timer);
        fail();
      },
      { once: true },
    );

    document.head.appendChild(script);
  });

  return pending;
}
