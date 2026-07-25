import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Button, IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { InlineError } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { dailyLogService } from '@/services/dailyLogService';
import { queryKeys } from '@/lib/queryKeys';
import { toDateString } from '@/utils/format';
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
});

const toActivityRequest = (item: ParsedActivityItem): CreateActivityEntryRequest => ({
  activityName: item.activityName,
  durationMinutes: item.durationMinutes && item.durationMinutes > 0 ? item.durationMinutes : 30,
  metValue: item.metValue && item.metValue >= 0.5 ? item.metValue : 3.5,
});

/**
 * The one place to log anything: AI text, photo, barcode, templates,
 * or manual entry. Always logs to today. One-shot flow: parse and save
 * in a single step, no confirmation screen.
 */
export function LogSheet({ open, initialTab, onClose }: LogSheetProps) {
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

  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const invalidateDay = (date: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(date) });
    queryClient.invalidateQueries({ queryKey: queryKeys.historyAll() });
    queryClient.invalidateQueries({ queryKey: queryKeys.streak() });
  };

  const onLogged = (date: string, count: number) => {
    invalidateDay(date);
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
      const date = toDateString();
      if (tab === 'meal') {
        const items = await dailyLogService.parseFood(date, { freeText }).then((r) => r.data);
        return saveFoods(date, items);
      }
      const items = await dailyLogService.parseActivity(date, { freeText }).then((r) => r.data);
      await dailyLogService.confirmParsedActivities(date, {
        items: items.map(toActivityRequest),
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
      const date = toDateString();
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
    onSuccess: ({ date, count }) => onLogged(date, count),
    onError: (err) =>
      setError(extractApiError(err, t('log.image_error', 'Could not read that photo. Try a clearer shot, or describe the meal in words.'))),
  });

  const addFromBarcode = useMutation({
    mutationFn: async (barcode: string) => {
      const date = toDateString();
      const items = await dailyLogService.lookupBarcode(barcode).then((r) => r.data);
      return saveFoods(date, items);
    },
    onSuccess: ({ date, count }) => onLogged(date, count),
    onError: (err) =>
      setError(extractApiError(err, t('log.barcode_error', 'Product not found. You can type the food instead.'))),
  });

  const busy = addFromText.isPending || addFromImage.isPending || addFromBarcode.isPending;

  const submit = () => {
    const trimmed = text.trim();
    if (trimmed.length < 2 || busy) return;
    setError(null);
    addFromText.mutate(trimmed);
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    addFromImage.mutate(file);
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
                        ? t('log.placeholder_meal', 'e.g. 2 eggs and toast with butter')
                        : t('log.placeholder_activity', 'e.g. 30 min easy run')
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
                  disabled={text.trim().length < 2}
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
          <ManualFood onBack={() => setView('input')} onDone={onLogged} />
        )}
        {view === 'manual' && tab === 'activity' && (
          <ManualActivity onBack={() => setView('input')} onDone={onLogged} />
        )}

        {view === 'templates' && (
          <TemplateQuickPick
            tab={tab}
            onBack={() => setView('input')}
            onAdded={(date) => invalidateDay(date)}
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
          onClose={(cameraError) => {
            setScanning(false);
            if (cameraError) {
              setError(t('log.camera_denied', 'Camera unavailable. Check camera permissions in your browser settings, or type the food instead.'));
            }
          }}
        />
      )}
    </>
  );
}
