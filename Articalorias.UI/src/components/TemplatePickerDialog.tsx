import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 8;

interface TemplateItem {
  id: number;
  label: string;
  meta?: string;
}

interface TemplatePickerDialogProps {
  open: boolean;
  title: string;
  items: TemplateItem[];
  onSelect: (id: number) => void;
  onClose: () => void;
  busy?: boolean;
}

export default function TemplatePickerDialog({ open, title, items, onSelect, onClose, busy }: TemplatePickerDialogProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  if (!open) return null;

  const filtered = items.filter(i => i.label.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(0);
  }

  function handleSelect(id: number) {
    onSelect(id);
    onClose();
    setSearch('');
    setPage(0);
  }

  function handleClose() {
    onClose();
    setSearch('');
    setPage(0);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tpd-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 shadow-2xl p-5 flex flex-col gap-3">
        {/* Title */}
        <h2 id="tpd-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder={t('common.search_placeholder')}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-8 pr-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
            {search ? t('common.no_results') : t('common.no_templates')}
          </p>
        ) : (
          <ul className="-mx-1 divide-y divide-gray-100 dark:divide-gray-800">
            {visible.map(item => (
              <li key={item.id}>
                <button
                  onClick={() => handleSelect(item.id)}
                  disabled={busy}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg disabled:opacity-50 transition-colors group"
                >
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 truncate">{item.label}</span>
                  {item.meta && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 whitespace-nowrap shrink-0">{item.meta}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={safePage === 0}
              aria-label="Previous page"
              className="rounded-md p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <span className="text-xs text-gray-400 dark:text-gray-500">{safePage + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={safePage === totalPages - 1}
              aria-label="Next page"
              className="rounded-md p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
        )}

        {/* Cancel */}
        <button
          onClick={handleClose}
          className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
