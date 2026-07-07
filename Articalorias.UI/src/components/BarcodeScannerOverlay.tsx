import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconX } from '@/components/icons';

interface BarcodeScannerOverlayProps {
  /**
   * Called immediately when a barcode is decoded.
   * The overlay stops polling and closes itself before calling this.
   */
  onDetected: (barcode: string) => void;
  /**
   * Called when the user taps the close button or when the camera cannot
   * be accessed. Pass `cameraError: true` when closing due to a permission
   * or hardware error so the parent can surface the right message.
   */
  onClose: (cameraError?: boolean) => void;
}

/** Width and height of the targeting rectangle in px. */
const ZONE = 260;

export default function BarcodeScannerOverlay({
  onDetected,
  onClose,
}: BarcodeScannerOverlayProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'starting' | 'scanning'>('starting');

  // Stable refs so the effect closure always invokes the latest callbacks
  // without needing them as effect dependencies (avoids camera restart on re-render).
  const onDetectedRef = useRef(onDetected);
  const onCloseRef    = useRef(onClose);
  onDetectedRef.current = onDetected;
  onCloseRef.current    = onClose;

  useEffect(() => {
    let cancelled  = false;
    let stream: MediaStream | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let fired      = false; // guard against double detection

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) { stream.getTracks().forEach(tr => tr.stop()); return; }

        const video = videoRef.current;
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
              clearInterval(intervalId!);
              if (navigator.vibrate) navigator.vibrate(100);
              onDetectedRef.current(results[0].rawValue);
            }
          } catch {
            // ignore per-frame detection errors (e.g. frame not ready)
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
      if (stream) stream.getTracks().forEach(tr => tr.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []); // intentional: effect runs once; callbacks accessed via refs above

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('dashboard.barcode_aria')}
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-black"
    >
      {/* Live camera feed */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Close button */}
      <button
        type="button"
        onClick={() => onClose()}
        aria-label={t('common.cancel')}
        className="absolute top-4 left-4 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-black/50 text-white hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white transition-colors"
        style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <IconX className="w-5 h-5" />
      </button>

      {/* Centered scan zone + status text */}
      <div className="relative flex flex-col flex-1 items-center justify-center gap-7 pointer-events-none">

        {/* Scan zone — box-shadow creates the dark vignette around it */}
        <div
          aria-hidden="true"
          className="relative rounded-sm shrink-0"
          style={{
            width: ZONE,
            height: ZONE,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.68)',
          }}
        >
          {/* Corner brackets */}
          <span className="absolute top-0 left-0  w-7 h-7 border-t-2 border-l-2 border-indigo-400 rounded-tl-sm" />
          <span className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-indigo-400 rounded-tr-sm" />
          <span className="absolute bottom-0 left-0  w-7 h-7 border-b-2 border-l-2 border-indigo-400 rounded-bl-sm" />
          <span className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-indigo-400 rounded-br-sm" />

          {/* Animated scan line — visible only while scanning */}
          {status === 'scanning' && (
            <div
              className="scan-line absolute left-2 right-2 top-3 h-px rounded-full"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.9) 50%, transparent 100%)',
              }}
            />
          )}
        </div>

        {/* Status text */}
        <p className="text-sm font-medium tracking-wide text-white/85 text-center px-8">
          {status === 'starting'
            ? t('dashboard.barcode_scanning')
            : t('dashboard.barcode_scanning_hint')}
        </p>
      </div>
    </div>
  );
}
