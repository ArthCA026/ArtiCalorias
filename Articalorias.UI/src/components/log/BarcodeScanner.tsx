import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/ui/Icon';

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  /** cameraError true when closing due to a permission or hardware error */
  onClose: (cameraError?: boolean) => void;
}

const ZONE = 260;

/** True when the native BarcodeDetector API is available (Chrome on Android). */
// eslint-disable-next-line react-refresh/only-export-components -- feature detection helper
export function barcodeSupported(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

/** Fullscreen camera overlay using the native BarcodeDetector. */
export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'starting' | 'scanning'>('starting');

  const onDetectedRef = useRef(onDetected);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onDetectedRef.current = onDetected;
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let fired = false;
    const video = videoRef.current;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;

        setStatus('scanning');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const BarcodeDetectorAPI = (window as any).BarcodeDetector;
        const formats: string[] = await BarcodeDetectorAPI.getSupportedFormats();
        const detector = new BarcodeDetectorAPI({ formats });

        intervalId = setInterval(async () => {
          if (fired || cancelled || !video || video.readyState < 2) return;
          try {
            const results: Array<{ rawValue: string }> = await detector.detect(video);
            if (results.length > 0 && !fired && !cancelled) {
              fired = true;
              if (intervalId) clearInterval(intervalId);
              if (navigator.vibrate) navigator.vibrate(100);
              onDetectedRef.current(results[0].rawValue);
            }
          } catch {
            /* frame not ready */
          }
        }, 300);
      } catch (err: unknown) {
        if (!cancelled) {
          const name = (err as { name?: string })?.name;
          onCloseRef.current(name === 'NotAllowedError' || name === 'NotFoundError');
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (stream) stream.getTracks().forEach((tr) => tr.stop());
      if (video) video.srcObject = null;
    };
  }, []);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('log.barcode_aria', 'Barcode scanner')}
      className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-black"
    >
      <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />

      <button
        type="button"
        onClick={() => onClose()}
        aria-label={t('common.cancel', 'Cancel')}
        className="absolute top-4 left-4 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-black/50 text-white"
        style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <Icon name="close" size={20} />
      </button>

      <div className="relative flex flex-col flex-1 items-center justify-center gap-7 pointer-events-none">
        <div
          aria-hidden="true"
          className="relative rounded-sm shrink-0"
          style={{ width: ZONE, height: ZONE, boxShadow: '0 0 0 9999px rgba(0,0,0,0.68)' }}
        >
          <span className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-white/90 rounded-tl-sm" />
          <span className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-white/90 rounded-tr-sm" />
          <span className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-white/90 rounded-bl-sm" />
          <span className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-white/90 rounded-br-sm" />
          {status === 'scanning' && (
            <div
              className="scan-line absolute left-2 right-2 top-3 h-px rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.9) 50%, transparent 100%)',
              }}
            />
          )}
        </div>
        <p className="text-sm font-medium tracking-wide text-white/85 text-center px-8">
          {status === 'starting'
            ? t('log.barcode_starting', 'Starting camera')
            : t('log.barcode_hint', 'Line up the barcode inside the frame')}
        </p>
      </div>
    </div>,
    document.body,
  );
}
