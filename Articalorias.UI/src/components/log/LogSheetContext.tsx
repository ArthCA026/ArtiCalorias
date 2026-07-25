import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { LogSheet } from './LogSheet';
import { toDateString } from '@/utils/format';

export type LogTab = 'meal' | 'activity';

interface LogSheetContextValue {
  /**
   * Open the logging sheet (the app's single primary action).
   * Logs to today unless a specific past date is given.
   */
  openLog: (tab?: LogTab, date?: string) => void;
}

const LogSheetContext = createContext<LogSheetContextValue | null>(null);

export function LogSheetProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<LogTab>('meal');
  const [targetDate, setTargetDate] = useState(() => toDateString());
  // Remount the sheet on every open so its internal state starts fresh
  const [session, setSession] = useState(0);

  const openLog = useCallback((initialTab: LogTab = 'meal', date?: string) => {
    setTab(initialTab);
    setTargetDate(date ?? toDateString());
    setSession((s) => s + 1);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openLog }), [openLog]);

  return (
    <LogSheetContext.Provider value={value}>
      {children}
      <LogSheet
        key={session}
        open={open}
        initialTab={tab}
        targetDate={targetDate}
        onClose={() => setOpen(false)}
      />
    </LogSheetContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- provider + hook belong together
export function useLogSheet(): LogSheetContextValue {
  const ctx = useContext(LogSheetContext);
  if (!ctx) throw new Error('useLogSheet must be used inside <LogSheetProvider>');
  return ctx;
}
