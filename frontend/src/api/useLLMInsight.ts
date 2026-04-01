/**
 * useLLMInsight — TanStack Query polling hook.
 *
 * Algorithm (3-phase state machine):
 *   Phase A: POST /api/v1/insights/ → obtain task_id    O(1)
 *   Phase B: useQuery with refetchInterval: 2000ms
 *            polls GET /api/v1/insights/{task_id}        O(1) per tick
 *   Phase C: status === "complete" → stop polling,
 *            return result data to consumer.
 *
 * Memory-safe: cleanup handled by TanStack Query's cache lifecycle.
 * No raw useEffect/setInterval → no leak vectors.
 */

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { enqueueInsight, pollInsight } from '@/api/client';
import type { InsightResult } from '@/types';

interface UseLLMInsightReturn {
  /** Trigger the LLM insight generation */
  trigger: () => void;
  /** True while the task is queued or processing */
  isLoading: boolean;
  /** True if the POST or any poll failed */
  isError: boolean;
  /** Error message if isError */
  error: string | null;
  /** The completed insight result (null while pending) */
  data: InsightResult | null;
  /** Reset state to allow re-triggering */
  reset: () => void;
}

export function useLLMInsight(year: number, userId: number = 1): UseLLMInsightReturn {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [enqueueError, setEnqueueError] = useState<string | null>(null);

  // ── Phase B: Poll with refetchInterval until complete ──────────────
  const {
    data: pollData,
    isError: isPollError,
    error: pollError,
  } = useQuery({
    queryKey: ['insight-poll', taskId],
    queryFn: () => pollInsight(taskId!),
    enabled: taskId !== null,                    // only poll after we have a task_id
    refetchInterval: (query) => {
      // Stop polling when status is "complete"
      if (query.state.data?.status === 'complete') return false;
      return 2000;                               // poll every 2s
    },
    refetchIntervalInBackground: false,
    retry: 3,
    staleTime: 0,
  });

  const isComplete = pollData?.status === 'complete';
  const insightResult = isComplete ? (pollData?.result ?? null) : null;

  // ── Phase A: Trigger POST to enqueue ───────────────────────────────
  const trigger = useCallback(async () => {
    setEnqueueError(null);
    setIsEnqueuing(true);
    try {
      const response = await enqueueInsight({ user_id: userId, year });
      setTaskId(response.task_id);
    } catch (err) {
      setEnqueueError(err instanceof Error ? err.message : 'Failed to enqueue');
    } finally {
      setIsEnqueuing(false);
    }
  }, [userId, year]);

  // ── Phase C: Reset ─────────────────────────────────────────────────
  const reset = useCallback(() => {
    setTaskId(null);
    setEnqueueError(null);
    setIsEnqueuing(false);
  }, []);

  const isLoading = isEnqueuing || (taskId !== null && !isComplete);
  const isError = enqueueError !== null || isPollError;
  const error = enqueueError ?? (isPollError ? String(pollError) : null);

  return { trigger, isLoading, isError, error, data: insightResult, reset };
}
