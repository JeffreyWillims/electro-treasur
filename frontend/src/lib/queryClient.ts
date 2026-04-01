/**
 * Shared QueryClient instance — accessible from both App.tsx and AuthContext.
 * Extracted to avoid circular dependencies.
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});
