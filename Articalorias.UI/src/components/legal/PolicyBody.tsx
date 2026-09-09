import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import type { PolicyDocument } from '@/legal/types';

/**
 * Renders a legal document's content: draft banner, version line, intro, and
 * sections. Shared by the full-page reader (public /legal routes) and the
 * in-flow PolicySheet so the text can never diverge between the two.
 */
export function PolicyBody({ policy }: { policy: PolicyDocument }) {
  const { t } = useTranslation();

  return (
    <div>
      {policy.draftBanner && (
        <div className="flex items-start gap-2.5 rounded-card bg-warning-soft px-4 py-3 mb-4">
          <Icon name="alertTriangle" size={18} className="text-warning mt-0.5 shrink-0" />
          <p className="text-[13px] font-semibold text-warning leading-snug">{policy.draftBanner}</p>
        </div>
      )}

      <p className="text-[13px] text-ink-3 mb-4">
        {t('legal.version_line', 'Version {{version}}, effective {{date}}', {
          version: policy.version,
          date: policy.effectiveDate,
        })}
      </p>

      <div className="space-y-2 mb-4">
        {policy.intro.map((p, i) => (
          <p key={i} className="text-sm text-ink-2 leading-relaxed">
            {p}
          </p>
        ))}
      </div>

      <div className="space-y-4">
        {policy.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-[15px] font-bold text-ink mb-1.5">{section.heading}</h2>
            {section.paragraphs?.map((p, i) => (
              <p key={i} className="text-sm text-ink-2 leading-relaxed mb-2">
                {p}
              </p>
            ))}
            {section.bullets && (
              <ul className="space-y-1.5 mb-2">
                {section.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink-2 leading-relaxed">
                    <span className="w-1 h-1 rounded-full bg-ink-3 mt-2 shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <p className="text-center text-[12px] text-ink-3 mt-6">ArtiCalorias · {policy.version}</p>
    </div>
  );
}
