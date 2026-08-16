import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { Sheet } from '@/components/ui/Sheet';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Button, IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { InlineError } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { dailyLogService } from '@/services/dailyLogService';
import { invalidateDayData } from '@/lib/queryKeys';
import { extractApiError } from '@/utils/apiError';
import { compressImage } from '@/utils/compressImage';
import type {
  CreateActivityEntryRequest,
  CreateFoodEntryRequest,
  ParsedActivityItem,
  ParsedFoodItem,
} from '@/types';
import { BarcodeScanner, barcodeSupported } from './BarcodeScanner';
import { ManualFood, ManualActivity } from './ManualEntry';
import { TemplateQuickPick } from './TemplateQuickPick';
import type { LogTab } from './LogSheetContext';

interface LogSheetProps {
  open: boolean;
  initialTab: LogTab;
  /** yyyy-MM-dd day the entries are logged to (today or a past day) */
  targetDate: string;
  onClose: () => void;
}

type View = 'input' | 'manual' | 'templates';

const toFoodRequest = (item: ParsedFoodItem): CreateFoodEntryRequest => ({
  foodName: item.foodName,
  portionDescription: item.portionDescription,
  quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
  caloriesKcal: item.caloriesKcal,
  proteinGrams: item.proteinGrams,
  fatGrams: item.fatGrams,
  carbsGrams: item.carbsGrams,
  alcoholGrams: item.alcoholGrams,
  // Only present when the user tracks them; null keeps the honest
  // "not captured" state in the database.
  sugarGrams: item.sugarGrams,
  waterMl: item.waterMl,
});

const toActivityRequest = (item: ParsedActivityItem, genericName: string): CreateActivityEntryRequest => {
  // The parser leaves the name empty on inputs like "200 kcal in 20 min".
  const activityName = item.activityName.trim() || genericName;

  if (item.caloriesKcal && item.caloriesKcal > 0) {
    // Smart-watch path: send exactly what the user said, nulls included. The
    // backend owns the math (MET from calories + duration, or duration from
    // calories + MET), so nothing gets defaulted into fake data here.
    return {
      activityName,
      durationMinutes: item.durationMinutes && item.durationMinutes > 0 ? item.durationMinutes : null,
      metValue: item.metValue && item.metValue >= 0.5 ? item.metValue : null,
      caloriesKcal: item.caloriesKcal,
    };
  }

  return {
    activityName,
    durationMinutes: item.durationMinutes && item.durationMinutes > 0 ? item.durationMinutes : 30,
    metValue: item.metValue && item.metValue >= 0.5 ? item.metValue : 3.5,
  };
};

/**
 * The one place to log anything: AI text, photo, barcode, templates,
 * or manual entry. Always logs to today. One-shot flow: parse and save
 * in a single step, no confirmation screen.
 */
export function LogSheet({ open, initialTab, targetDate, onClose }: LogSheetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // The provider remounts this component (fresh key) on every open,
  // so initial state here is always a clean slate.
  const [tab, setTab] = useState<LogTab>(initialTab);
  const [view, setView] = useState<View>('input');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  // A picked photo is staged, not sent: the user can add text context
  // (like in a chat) and then presses Add to send photo + text together.
  const [pendingImage, setPendingImage] = useState<{ file: File; url: string } | null>(null);

  const clearImage = () => {
    setPendingImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  };

  // Release the preview object URL when the sheet unmounts mid-staging
  useEffect(
    () => () => {
      setPendingImage((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return prev;
      });
    },
    [],
  );

  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const onLogged = (_date: string, count: number) => {
    invalidateDayData(queryClient);
    toast(
      'success',
      count === 1
        ? t('log.logged_one', 'Logged. Nice one!')
        : t('log.logged_many', '{{count}} items logged. Nice one!', { count }),
    );
    onClose();
  };

  const saveFoods = async (date: string, items: ParsedFoodItem[]) => {
    await dailyLogService.confirmParsedFoods(date, { items: items.map(toFoodRequest) });
    return { date, count: items.length };
  };

  const addFromText = useMutation({
    mutationFn: async (freeText: string) => {
      const date = targetDate;
      if (tab === 'meal') {
        const items = await dailyLogService.parseFood(date, { freeText }).then((r) => r.data);
        return saveFoods(date, items);
      }
      const items = await dailyLogService.parseActivity(date, { freeText }).then((r) => r.data);
      await dailyLogService.confirmParsedActivities(date, {
        items: items.map((i) => toActivityRequest(i, t('log.generic_exercise', 'Exercise'))),
      });
      return { date, count: items.length };
    },
    onSuccess: ({ date, count }) => onLogged(date, count),
    onError: (err) =>
      setError(
        extractApiError(
          err,
          tab === 'meal'
            ? t('log.parse_error', 'Could not understand that. Try describing the food differently, or enter it manually.')
            : t('log.parse_error_activity', 'Could not understand that. Try something like "30 min running", or enter it manually.'),
        ),
      ),
  });

  const addFromImage = useMutation({
    mutationFn: async (file: File) => {
      const date = targetDate;
      const { base64, mimeType } = await compressImage(file);
      const items = await dailyLogService
        .parseFoodWithImage(date, {
          imageBase64: base64,
          mimeType,
          freeText: text.trim() || null,
        })
        .then((r) => r.data);
      return saveFoods(date, items);
    },
    onSuccess: ({ date, count }) => {
      clearImage();
      onLogged(date, count);
    },
    // The staged photo stays on error, so retrying or adding context is one tap.
    onError: (err) =>
      setError(extractApiError(err, t('log.image_error', 'Could not read that photo. Try a clearer shot, or add a line of context below and press Add again.'))),
  });

  const addFromBarcode = useMutation({
    mutationFn: async (barcode: string) => {
      const date = targetDate;
      const items = await dailyLogService.lookupBarcode(barcode).then((r) => r.data);
      return saveFoods(date, items);
    },
    onSuccess: ({ date, count }) => onLogged(date, count),
    // Each failure mode gets its own words, so the user knows whether the
    // product is missing, they scanned too fast, or the network dropped.
    onError: (err) => {
      if (err instanceof AxiosError && err.response?.status === 404) {
        setError(t('log.barcode_not_found', 'Scanned fine, but this product is not in the food database yet. Snap a photo of it or type it instead.'));
      } else if (err instanceof AxiosError && err.response?.status === 429) {
        setError(t('log.barcode_cooldown', 'Two scans very close together. Give it a few seconds and scan again.'));
      } else if (err instanceof AxiosError && !err.response) {
        setError(t('log.barcode_offline', 'Could not reach the food database. Check your connection and try again.'));
      } else {
        setError(extractApiError(err, t('log.barcode_error', 'The lookup failed. You can type the food instead.')));
      }
    },
  });

  const busy = addFromText.isPending || addFromImage.isPending || addFromBarcode.isPending;

  const canSubmit = pendingImage !== null || text.trim().length >= 2;

  const submit = () => {
    if (!canSubmit || busy) return;
    setError(null);
    // A staged photo wins: it goes out with whatever text was added as context.
    if (pendingImage) {
      addFromImage.mutate(pendingImage.file);
      return;
    }
    addFromText.mutate(text.trim());
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    // Stage the photo; a second pick replaces the first.
    setPendingImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { file, url: URL.createObjectURL(file) };
    });
  };

  const onBarcodeClick = () => {
    if (!barcodeSupported()) {
      setError(t('log.barcode_unsupported', 'Barcode scanning needs a phone camera in Chrome. On this device, type the food or snap a photo instead.'));
      return;
    }
    setError(null);
    setScanning(true);
  };

  const title =
    view === 'templates'
      ? t('log.from_templates', 'From templates')
      : view === 'manual'
        ? t('log.manual_title', 'Manual entry')
        : t('log.title', 'Log');

  return (
    <>
      <Sheet open={open} onClose={onClose} title={title}>
        {view === 'input' && (
          <div className="space-y-4">
            <SegmentedControl<LogTab>
              aria-label={t('log.type_switch', 'What are you logging?')}
              options={[
                { value: 'meal', label: t('log.meal', 'Meal'), icon: 'meal' },
                { value: 'activity', label: t('log.activity', 'Activity'), icon: 'activity' },
              ]}
              value={tab}
              onChange={(v) => {
                setTab(v);
                setText('');
                setError(null);
                clearImage();
              }}
            />

            {busy ? (
              <div className="rounded-card bg-inset px-5 py-8 flex flex-col items-center text-center">
                <span className="text-primary animate-pulse">
                  <Icon name="sparkles" size={28} />
                </span>
                <p className="mt-3 text-[15px] font-bold text-ink">
                  {tab === 'meal'
                    ? t('log.adding_meal', 'Adding your meal')
                    : t('log.adding_activity', 'Adding your activity')}
                </p>
                <p className="mt-1 text-[13px] text-ink-2">
                  {t('log.analyzing_hint', 'This usually takes a few seconds')}
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-card bg-inset p-3">
                  {pendingImage && (
                    <div className="flex items-center gap-3 mb-2 rounded-xl bg-card p-2">
                      <img
                        src={pendingImage.url}
                        alt={t('log.photo_preview_alt', 'Photo of your meal')}
                        className="w-14 h-14 rounded-lg object-cover shrink-0"
                      />
                      <span className="flex-1 text-[13px] text-ink-2 leading-snug">
                        {t('log.photo_attached', 'Photo attached. Add any detail that helps, then press Add.')}
                      </span>
                      <IconButton
                        icon="close"
                        label={t('log.remove_photo', 'Remove photo')}
                        size={32}
                        iconSize={16}
                        variant="inset"
                        onClick={clearImage}
                      />
                    </div>
                  )}
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      const el = e.target;
                      el.style.height = 'auto';
                      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                    }}
                    rows={2}
                    enterKeyHint="send"
                    placeholder={
                      tab === 'meal'
                        ? pendingImage
                          ? t('log.placeholder_photo_context', 'Optional: add context, like "the bowl is 500 ml"')
                          : t('log.placeholder_meal', 'e.g. 2 eggs and toast with butter')
                        : t('log.placeholder_activity', 'e.g. 30 min easy run, or 200 kcal from your watch')
                    }
                    className="w-full bg-transparent resize-none text-base text-ink placeholder:text-ink-3 px-1.5 py-1 focus-visible:shadow-none"
                  />
                  {tab === 'meal' && (
                    <div className="flex items-center gap-1 pt-1">
                      <IconButton
                        icon="camera"
                        label={t('log.take_photo', 'Take a photo')}
                        variant="inset"
                        size={40}
                        onClick={() => cameraInput.current?.click()}
                      />
                      <IconButton
                        icon="image"
                        label={t('log.choose_photo', 'Choose a photo')}
                        variant="inset"
                        size={40}
                        onClick={() => galleryInput.current?.click()}
                      />
                      <IconButton
                        icon="barcode"
                        label={t('log.scan_barcode', 'Scan a barcode')}
                        variant="inset"
                        size={40}
                        onClick={onBarcodeClick}
                      />
                    </div>
                  )}
                </div>

                {error && <InlineError message={error} />}

                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  icon="plus"
                  disabled={!canSubmit}
                  onClick={submit}
                >
                  {t('log.add', 'Add')}
                </Button>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setView('templates')}
                    className="pressable flex flex-col items-center gap-1.5 rounded-card bg-inset active:bg-press px-3 py-3.5"
                  >
                    <span className="w-9 h-9 rounded-xl bg-primary-soft text-primary-soft-ink flex items-center justify-center">
                      <Icon name="bookmark" size={18} />
                    </span>
                    <span className="text-[13px] font-semibold text-ink">
                      {t('log.from_templates', 'From templates')}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('manual')}
                    className="pressable flex flex-col items-center gap-1.5 rounded-card bg-inset active:bg-press px-3 py-3.5"
                  >
                    <span className="w-9 h-9 rounded-xl bg-primary-soft text-primary-soft-ink flex items-center justify-center">
                      <Icon name="pencil" size={18} />
                    </span>
                    <span className="text-[13px] font-semibold text-ink">
                      {t('log.manual', 'Enter manually')}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {view === 'manual' && tab === 'meal' && (
          <ManualFood date={targetDate} onBack={() => setView('input')} onDone={onLogged} />
        )}
        {view === 'manual' && tab === 'activity' && (
          <ManualActivity date={targetDate} onBack={() => setView('input')} onDone={onLogged} />
        )}

        {view === 'templates' && (
          <TemplateQuickPick
            tab={tab}
            date={targetDate}
            onBack={() => setView('input')}
            onAdded={() => invalidateDayData(queryClient)}
          />
        )}

        {/* Hidden pickers with the right capture behavior */}
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <input
          ref={galleryInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </Sheet>

      {scanning && (
        <BarcodeScanner
          onDetected={(code) => {
            setScanning(false);
            addFromBarcode.mutate(code);
          }}
          onClose={(reason) => {
            setScanning(false);
            if (reason === 'denied') {
              setError(t('log.camera_denied', 'Camera access is blocked. Allow the camera for this site in your browser settings, or type the food instead.'));
            } else if (reason === 'unavailable') {
              setError(t('log.camera_unavailable', 'No usable camera was found on this device. Choose a photo from your gallery or type the food instead.'));
            }
          }}
        />
      )}
    </>
  );
}
