import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/Progress';
import { Icon } from '@/components/ui/Icon';
import { useLogSheet } from '@/components/log/LogSheetContext';
import { cn } from '@/utils/cn';

interface ChecklistCardProps {
  hasGoal: boolean;
}

/**
 * First-day checklist. Endowed progress: creating the account already
 * counts as step one, so the bar never starts at zero and finishing
 * feels close from the start.
 */
export function ChecklistCard({ hasGoal }: ChecklistCardProps) {
  const { t } = useTranslation();
  const { openLog } = useLogSheet();
  const navigate = useNavigate();

  const steps = [
    { label: t('today.step_account', 'Create your account'), done: true, action: undefined },
    {
      label: t('today.step_goal', 'Set your goal'),
      done: hasGoal,
      action: hasGoal ? undefined : () => navigate('/profile'),
    },
    {
      label: t('today.step_meal', 'Log your first meal'),
      done: false,
      action: () => openLog('meal'),
    },
  ];
  const done = steps.filter((s) => s.done).length;

  return (
    <Card variant="soft">
      <p className="text-[15px] font-bold text-primary-soft-ink">
        {t('today.checklist_title', 'You are {{done}} of 3 steps in', { done })}
      </p>
      <div className="mt-2.5">
        <ProgressBar progress={done / 3} label={t('today.checklist_aria', 'Setup progress')} />
      </div>
      <ul className="mt-3.5 space-y-2.5">
        {steps.map((s, i) => (
          <li key={i}>
            <button
              type="button"
              disabled={!s.action}
              onClick={s.action}
              className={cn(
                'flex items-center gap-2.5 w-full text-left',
                s.action && 'pressable',
              )}
            >
              <span
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                  s.done ? 'bg-primary text-on-primary' : 'bg-card text-ink-3',
                )}
              >
                {s.done ? (
                  <Icon name="check" size={13} strokeWidth={3} />
                ) : (
                  <span className="text-[11px] font-bold">{i + 1}</span>
                )}
              </span>
              <span
                className={cn(
                  'text-sm font-semibold',
                  s.done ? 'text-ink-3 line-through' : 'text-ink',
                )}
              >
                {s.label}
              </span>
              {s.action && <Icon name="chevronRight" size={16} className="ml-auto text-ink-3" />}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
