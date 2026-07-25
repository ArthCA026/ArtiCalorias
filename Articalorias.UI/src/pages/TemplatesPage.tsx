import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { MealTemplates } from '@/components/templates/MealTemplates';
import { ActivityTemplates } from '@/components/templates/ActivityTemplates';
import { Routines } from '@/components/templates/Routines';

type TemplatesTab = 'meals' | 'activities' | 'routines';

/** Saved meals, activities and routines: create, edit and log them in one tap. */
export default function TemplatesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TemplatesTab>('meals');

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[22px] font-extrabold text-ink leading-tight">
          {t('templates.title', 'Templates')}
        </h1>
        <p className="text-[13px] text-ink-2">
          {t('templates.subtitle', 'Your saved meals, activities and routines')}
        </p>
      </header>

      <SegmentedControl<TemplatesTab>
        aria-label={t('templates.tabs_aria', 'Template type')}
        options={[
          { value: 'meals', label: t('templates.tab_meals', 'Meals'), icon: 'meal' },
          { value: 'activities', label: t('templates.tab_activities', 'Activities'), icon: 'activity' },
          { value: 'routines', label: t('templates.tab_routines', 'Routines'), icon: 'repeat' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'meals' && <MealTemplates />}
      {tab === 'activities' && <ActivityTemplates />}
      {tab === 'routines' && <Routines />}
    </div>
  );
}
