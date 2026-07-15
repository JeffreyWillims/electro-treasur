/* eslint-disable */
/**
 * useLLMInsight — хук поллинга на TanStack Query.
 *
 * Алгоритм (конечный автомат из 3 фаз):
 *   Фаза A: POST /api/v1/insights/ → получаем task_id    O(1)
 *   Фаза B: useQuery с refetchInterval: 2000мс
 *            опрашивает GET /api/v1/insights/{task_id}    O(1) на тик
 *   Фаза C: status === "complete" → останавливаем поллинг,
 *            возвращаем результат потребителю.
 *
 * Безопасно по памяти: очистка на жизненном цикле кэша TanStack Query.
 * Без сырых useEffect/setInterval → нет векторов утечки.
 */

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { enqueueInsight, pollInsight } from '@/api/client';
import type { InsightResult } from '@/types';

interface UseLLMInsightReturn {
  /** Запускает генерацию AI Анализа */
  trigger: () => void;
  /** True, пока задача в очереди или обрабатывается */
  isLoading: boolean;
  /** True, если POST или любой опрос завершился ошибкой */
  isError: boolean;
  /** Сообщение об ошибке, если isError */
  error: string | null;
  /** Готовый результат анализа (null, пока не готов) */
  data: InsightResult | null;
  /** Сбрасывает состояние для повторного запуска */
  reset: () => void;
}

export function useLLMInsight(startDate: string, endDate: string): UseLLMInsightReturn {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [enqueueError, setEnqueueError] = useState<string | null>(null);

  // ── Фаза B: опрос через refetchInterval до готовности ──────────────
  const {
    data: pollData,
    isError: isPollError,
    error: pollError,
  } = useQuery({
    queryKey: ['insight-poll', taskId],
    queryFn: () => pollInsight(taskId!),
    enabled: taskId !== null,                    // опрашиваем только когда есть task_id
    refetchInterval: (query) => {
      // Останавливаем опрос, когда статус "complete"
      if (query.state.data?.status === 'complete') return false;
      return 2000;                               // опрос каждые 2с
    },
    refetchIntervalInBackground: false,
    retry: 3,
    staleTime: 0,
  });

  const isComplete = pollData?.status === 'complete';
  const insightResult = isComplete ? (pollData?.result ?? null) : null;

  // ── Фаза A: POST для постановки в очередь ───────────────────────────────
  const trigger = useCallback(async () => {
    setEnqueueError(null);
    setIsEnqueuing(true);
    try {
       
      const response = await enqueueInsight({ start_date: startDate, end_date: endDate } as any);
      setTaskId(response.task_id);
    } catch (err) {
      setEnqueueError(err instanceof Error ? err.message : 'Failed to enqueue');
    } finally {
      setIsEnqueuing(false);
    }
  }, [startDate, endDate]);

  // ── Фаза C: сброс ─────────────────────────────────────────────────
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
