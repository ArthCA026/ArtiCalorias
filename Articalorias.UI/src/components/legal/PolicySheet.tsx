import { Sheet } from '@/components/ui/Sheet';
import { useLanguage } from '@/hooks/useLanguage';
import { getPolicyDocument, type PolicyDocKey } from '@/legal/documents';
import { PolicyBody } from './PolicyBody';

interface PolicySheetProps {
  /** Which document to show; null = closed. */
  doc: PolicyDocKey | null;
  onClose: () => void;
}

/**
 * In-flow policy reader. Opens the document as a bottom sheet OVER the
 * current screen, so reading the terms mid-registration (or mid-onboarding)
 * never navigates away and never loses form state. The full-page reader at
 * /legal/* remains for Profile links and as the public hosted-policy URL.
 */
export function PolicySheet({ doc, onClose }: PolicySheetProps) {
  const { language } = useLanguage();
  const policy = doc ? getPolicyDocument(doc, language) : null;

  return (
    <Sheet open={doc !== null} onClose={onClose} title={policy?.title}>
      {policy && <PolicyBody policy={policy} />}
    </Sheet>
  );
}
