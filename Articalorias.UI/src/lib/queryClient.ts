import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min — data won't refetch within this window
      gcTime: 15 * 60 * 1000,   // 15 min — keep unused cache in memory after unmount
      refetchOnWindowFocus: false, // PWA on mobile: focus events are too aggressive
      refetchOnReconnect: true,    // Useful when mobile network reconnects
      retry: 1,
    },
  },
});
