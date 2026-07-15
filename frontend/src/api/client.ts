/**
 * API Client — типизированные fetch-обёртки для бэкенда Citrine Vault.
 * Все ответы валидируются по контрактным типам. Ноль `any` в публичном API.
 *
 * Auth: httpOnly cookies, выставляемые бэкендом. Каждый запрос шлёт cookie
 * (credentials: 'include'); на 401 прозрачно делаем один refresh и повторяем
 * запрос, иначе — редирект на /login. Bearer-токенов и localStorage больше нет.
 */

import type {
  InsightEnqueueResponse,
  InsightRequest,
  InsightResultResponse,
  DashboardResponse,
  TransactionCreate,
  TransactionResponse,
  TransactionPaginatedResponse,
  TransactionUpdate,
  AnalyticsProfileResponse,
  SimulateRequest,
  SimulateResponse,
  CategoryRead,
  CategoryCreate,
  CategoryUpdate,
  CategoryTransactionCount,
  UserRead,
  UserUpdate,
  BudgetUpsert,
  TelegramOtpResponse,
  ImportResult,
  ApiKeyInfo,
  ApiKeyCreatedResponse,
  ClientInfo,
} from '@/types';

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Человекочитаемая ошибка API. FastAPI на 422 присылает массив объектов
 * валидации, rate-limit — английскую строку («5 per 1 minute») — сводим
 * всё к понятной русской фразе для тостов и инлайн-ошибок форм.
 */
function humanizeDetail(status: number, detail: unknown): string {
  if (status === 429) return 'Слишком много попыток. Подождите минуту и попробуйте снова.';
  if (Array.isArray(detail)) {
    const msgs = detail.map((d: { loc?: unknown[]; type?: string; msg?: string }) => {
      const loc = String(d?.loc?.[d.loc.length - 1] ?? '');
      const type = String(d?.type ?? '');
      if (loc === 'email' || type.includes('email')) {
        return 'Проверьте формат email — например, name@example.com.';
      }
      if (loc === 'password' && type === 'string_too_short') {
        return 'Пароль слишком короткий — нужно не меньше 8 символов.';
      }
      return d?.msg ? String(d.msg) : 'Проверьте правильность заполнения полей.';
    });
    return [...new Set(msgs)].join(' ');
  }
  if (typeof detail === 'string' && detail) return detail;
  return `Ошибка запроса (${status})`;
}

function isAuthEndpoint(url: string): boolean {
  // На эти эндпоинты не запускаем авто-refresh, чтобы не зациклиться.
  return url.includes('/auth/login') || url.includes('/auth/refresh');
}

// Единственный in-flight refresh: параллельные 401 не плодят рефреши.
let refreshPromise: Promise<boolean> | null = null;
function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function redirectToLogin(): void {
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

/**
 * Низкоуровневый fetch: всегда шлёт cookie (credentials: 'include'). На 401
 * (кроме /auth/login и /auth/refresh) один раз пытается refresh и повторяет
 * запрос; если refresh не удался — редирект на /login. Возвращает сырой Response.
 */
async function apiFetch(
  url: string,
  options: RequestInit = {},
  retry = false,
): Promise<Response> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    credentials: 'include',
  });

  if (response.status === 401 && !retry && !isAuthEndpoint(url)) {
    const refreshed = await refreshSession();
    if (refreshed) return apiFetch(url, options, true);
    redirectToLogin();
  }

  return response;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
    throw new ApiError(response.status, humanizeDetail(response.status, errorBody.detail));
  }

  return response.json() as Promise<T>;
}

// ── Интеграция с Telegram ──────────────────────────────────────────────
export function generateTelegramOtp(): Promise<TelegramOtpResponse> {
  return request<TelegramOtpResponse>('/v1/users/telegram-link', {
    method: 'POST',
  });
}

// ── Транзакции ───────────────────────────────────────────────────────
export function createTransaction(
  payload: TransactionCreate,
  idempotencyKey?: string,
): Promise<TransactionResponse> {
  const headers: Record<string, string> = {};
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  // 1. Приводим сумму к строке для строгой валидации Decimal в Pydantic V2
  // 2. Безопасно заменяем 'Z' на '+00:00' для совместимости с isoformat в Python <3.11
  const safePayload = {
    ...payload,
    amount: payload.amount.toString(),
    executed_at: new Date(payload.executed_at).toISOString().replace('Z', '+00:00'),
  };

  return request<TransactionResponse>('/v1/transactions/', {
    method: 'POST',
    body: JSON.stringify(safePayload),
    headers,
  });
}

export function fetchTransactions(
  limit = 10,
  offset = 0,
  categoryId?: string,
  type?: string,
  minAmount?: string,
  maxAmount?: string,
  startDate?: string,
  endDate?: string,
  search?: string,
): Promise<TransactionPaginatedResponse> {
  const params = new URLSearchParams();
  params.append('limit', limit.toString());
  params.append('offset', offset.toString());
  if (categoryId) params.append('category_id', categoryId);
  if (type) params.append('type', type);
  if (minAmount) params.append('min_amount', minAmount);
  if (maxAmount) params.append('max_amount', maxAmount);
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (search) params.append('search', search);

  return request<TransactionPaginatedResponse>(`/v1/transactions/?${params.toString()}`);
}

export function updateTransaction(
  id: number,
  payload: TransactionUpdate,
): Promise<TransactionResponse> {
  return request<TransactionResponse>(`/v1/transactions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...payload,
      amount: payload.amount !== undefined ? payload.amount.toString() : undefined,
    }),
  });
}

export async function deleteTransaction(id: number): Promise<void> {
  const response = await apiFetch(`/v1/transactions/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
    throw new ApiError(response.status, errorBody.detail || `API error: ${response.status}`);
  }
  // 204 No Content — тела ответа нет
}

// ── Дашборд ──────────────────────────────────────────────────────────
export function fetchDashboard(startDate: string, endDate: string): Promise<DashboardResponse> {
  return request<DashboardResponse>(`/v1/dashboard/?start_date=${startDate}&end_date=${endDate}`);
}

// ── LLM Insights (AI Анализ) ───────────────────────────────────────────────────────
export function enqueueInsight(body: InsightRequest): Promise<InsightEnqueueResponse> {
  return request<InsightEnqueueResponse>('/v1/insights/', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function pollInsight(taskId: string): Promise<InsightResultResponse> {
  return request<InsightResultResponse>(`/v1/insights/${taskId}`);
}

// ── Аналитика и симуляция ─────────────────────────────────────────────
export function fetchAnalyticsProfile(): Promise<AnalyticsProfileResponse> {
  return request<AnalyticsProfileResponse>('/v1/analytics/profile');
}

export function simulateSavings(body: SimulateRequest): Promise<SimulateResponse> {
  return request<SimulateResponse>('/v1/analytics/simulate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ── Аутентификация ────────────────────────────────────────────────────
// Бэкенд ставит httpOnly-cookie и НЕ возвращает токены в теле — поэтому login
// возвращает void: успех определяется отсутствием ошибки.
export async function login(username: string, password: string): Promise<void> {
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);

  const response = await apiFetch('/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new ApiError(response.status, humanizeDetail(response.status, err.detail));
  }
}

export async function logout(): Promise<void> {
  // Бэкенд отзывает refresh в Redis и чистит cookie; тело не нужно.
  await apiFetch('/v1/auth/logout', { method: 'POST' });
}

export function register(payload: { email: string; password: string; full_name?: string; phone?: string }): Promise<UserRead> {
  return request<UserRead>('/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── Профиль пользователя ──────────────────────────────────────────────────────
export function fetchMe(): Promise<UserRead> {
  return request<UserRead>('/v1/users/me');
}

export function updateMe(payload: UserUpdate): Promise<UserRead> {
  return request<UserRead>('/v1/users/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// ── Категории ────────────────────────────────────────────────────────
export function fetchCategories(): Promise<CategoryRead[]> {
  return request<CategoryRead[]>('/v1/users/categories');
}

export function createCategory(payload: CategoryCreate): Promise<CategoryRead> {
  return request<CategoryRead>('/v1/users/categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchCategoryTransactionCount(
  categoryId: number,
): Promise<CategoryTransactionCount> {
  return request<CategoryTransactionCount>(
    `/v1/users/categories/${categoryId}/transaction-count`,
  );
}

export function updateCategory(
  categoryId: number,
  payload: CategoryUpdate,
): Promise<CategoryRead> {
  return request<CategoryRead>(`/v1/users/categories/${categoryId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteCategory(categoryId: number): Promise<void> {
  const response = await apiFetch(`/v1/users/categories/${categoryId}`, { method: 'DELETE' });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
    throw new ApiError(response.status, errorBody.detail || `API error: ${response.status}`);
  }
  // 204 No Content — тела ответа нет
}

// ── Бюджеты ───────────────────────────────────────────────────────────
export function upsertBudget(payload: BudgetUpsert): Promise<{ status: string; amount_limit: string }> {
  // Pydantic строго проверяет формат суммы
  const safePayload = {
    ...payload,
    amount_limit: payload.amount_limit.toString(),
  };

  return request<{ status: string; amount_limit: string }>('/v1/budgets/', {
    method: 'PUT',
    body: JSON.stringify(safePayload),
  });
}

export async function deleteBudget(categoryId: number, month: number, year: number): Promise<void> {
  const response = await apiFetch(
    `/v1/budgets/${categoryId}?month=${month}&year=${year}`,
    { method: 'DELETE' },
  );
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
    throw new ApiError(response.status, errorBody.detail || `API error: ${response.status}`);
  }
}

// ── Data Vault: импорт / экспорт ────────────────────────────────────────────

/**
 * Скачивает все транзакции пользователя в виде CSV-файла.
 * Создаёт скрытый элемент <a>, эмулирует клик, затем убирает за собой.
 */
export async function exportTransactions(): Promise<void> {
  const response = await apiFetch('/v1/transactions/export');

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
    throw new ApiError(response.status, errorBody.detail || 'Export failed');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `citrine_vault_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Загружает CSV или Excel файл для импорта транзакций.
 * Использует FormData — браузер сам проставляет multipart Content-Type с boundary.
 */
export async function importTransactions(file: File): Promise<ImportResult> {
  // ВАЖНО: не задавать Content-Type вручную — браузер должен сам выставить multipart boundary
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiFetch('/v1/transactions/import', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: 'Import failed' }));
    throw new ApiError(response.status, errorBody.detail || `API error: ${response.status}`);
  }

  return response.json() as Promise<ImportResult>;
}


// ── Банковские предложения (CPA в Горизонте капитала) ────────────────────────────────
export interface BankOfferDto {
  id: number;
  name: string;
  rate: string;
  color: string;
  partner_url: string | null;
}

export function fetchBankOffers(): Promise<BankOfferDto[]> {
  return request<BankOfferDto[]>('/v1/offers/');
}

/** Счётчик воронки в режиме fire-and-forget; у 204 нет тела, поэтому ответ игнорируем. */
export function clickBankOffer(offerId: number): Promise<void> {
  return apiFetch(`/v1/offers/${offerId}/click`, { method: 'POST' }).then(() => undefined);
}

// ── Последний сохранённый месячный анализ (Cashflow Prophet) ────────────────
export interface Psychopassport {
  persona_code: string;
  persona_title: string;
  traits: string[];
  recommendations: string[];
}

export interface LatestInsightDto {
  period_start: string;
  period_end: string;
  advice: string;
  summary: Record<string, unknown>;
  model_used: string;
  created_at: string;
  psychopassport?: Psychopassport | null;
}

export function fetchLatestInsight(): Promise<LatestInsightDto | null> {
  return request<LatestInsightDto | null>('/v1/insights/latest');
}

export function fetchInsightHistory(limit = 12): Promise<LatestInsightDto[]> {
  return request<LatestInsightDto[]>(`/v1/insights/?limit=${limit}`);
}

// ── Индекс финансового здоровья ────────────────────────────────────────
export interface HealthFactor {
  name: string;
  score: number;
  weight: number;
  detail: string;
}

export interface HealthScore {
  score: number;
  grade: string;
  factors: HealthFactor[];
}

export function fetchHealthScore(): Promise<HealthScore> {
  return request<HealthScore>('/v1/health-score/');
}

// ── Savings Goals (режим «Цель») ───────────────────────────────────────
export interface GoalDto {
  id: number;
  name: string;
  target_amount: string;
  target_date: string | null;
  monthly_plan: string | null;
  current_amount: string;
  created_at: string;
  progress_pct: number;
  remaining: string;
}

export interface GoalCreate {
  name: string;
  target_amount: string;
  target_date?: string | null;
  monthly_plan?: string | null;
}

export function fetchGoals(): Promise<GoalDto[]> {
  return request<GoalDto[]>('/v1/goals/');
}

export function createGoal(payload: GoalCreate): Promise<GoalDto> {
  return request<GoalDto>('/v1/goals/', { method: 'POST', body: JSON.stringify(payload) });
}

export function contributeGoal(goalId: number, amount: string): Promise<GoalDto> {
  return request<GoalDto>(`/v1/goals/${goalId}/contribute`, {
    method: 'PATCH',
    body: JSON.stringify({ amount }),
  });
}

export function deleteGoal(goalId: number): Promise<void> {
  return apiFetch(`/v1/goals/${goalId}`, { method: 'DELETE' }).then(() => undefined);
}

// ── Импорт выписок (PDF/картинка/Excel) ────────────────────────────────
export interface StatementCandidate {
  amount: number;
  type: 'income' | 'expense';
  description: string;
  category?: string | null;
}

export interface StatementTask {
  task_id: string;
  status: 'pending' | 'complete';
  result?: { file_name: string; candidates: StatementCandidate[]; count: number } | null;
}

export interface ConfirmImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

export async function uploadStatement(file: File): Promise<{ task_id: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiFetch('/v1/imports/statement', { method: 'POST', body: formData });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new ApiError(response.status, err.detail || `API error: ${response.status}`);
  }
  return response.json() as Promise<{ task_id: string }>;
}

export function pollStatement(taskId: string): Promise<StatementTask> {
  return request<StatementTask>(`/v1/imports/${taskId}`);
}

export function confirmStatementImport(
  items: StatementCandidate[],
): Promise<ConfirmImportResult> {
  const payload = {
    items: items.map((i) => ({
      amount: String(i.amount),
      type: i.type,
      description: i.description,
      category: i.category ?? null,
    })),
  };
  return request<ConfirmImportResult>('/v1/imports/confirm', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── Справочник «Налоги и вычеты» (Postgres FTS) ────────────────────────
export interface TaxRule {
  id: number;
  category: string;
  title: string;
  body: string;
  source: string | null;
}

export function searchTaxRules(q: string): Promise<TaxRule[]> {
  const query = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
  return request<TaxRule[]>(`/v1/tax/search${query}`);
}

export function fetchTaxCategories(): Promise<string[]> {
  return request<string[]>('/v1/tax/categories');
}

export interface DeductionKind {
  kind: string;
  label: string;
  base_limit: string;
  note: string;
}

export interface DeductionResult {
  kind: string;
  label: string;
  eligible_base: string;
  refund: string;
  base_limit: string;
  capped_by_income: boolean;
  note: string;
}

export function fetchDeductionKinds(): Promise<DeductionKind[]> {
  return request<DeductionKind[]>('/v1/tax/deductions');
}

export function calcDeduction(
  kind: string,
  amount: string,
  annualIncome?: string,
): Promise<DeductionResult> {
  return request<DeductionResult>('/v1/tax/calc', {
    method: 'POST',
    body: JSON.stringify({ kind, amount, annual_income: annualIncome || null }),
  });
}

// ── PDF-отчёт «Личный финансовый план» ─────────────────────────────────
export async function downloadFinancialPlanPdf(): Promise<void> {
  const response = await apiFetch('/v1/reports/financial-plan.pdf');
  if (!response.ok) {
    throw new ApiError(response.status, 'Не удалось сформировать PDF');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'financial-plan.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Обратная связь ───────────────────────────────────────────────────────────
export function submitFeedback(message: string): Promise<{ status: string }> {
  return request<{ status: string }>('/v1/feedback/', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

// ── Citrine Arcade (игры) ─────────────────────────────────────────────────────
export interface LeaderboardEntry {
  name: string;
  score: number;
}

export function fetchLeaderboard(game: string): Promise<LeaderboardEntry[]> {
  return request<LeaderboardEntry[]>(`/v1/games/leaderboard?game=${game}`);
}

export function submitGameScore(game: string, score: number): Promise<{ status: string }> {
  return request<{ status: string }>('/v1/games/score', {
    method: 'POST',
    body: JSON.stringify({ game, score }),
  });
}

export function fetchTotalLeaderboard(): Promise<LeaderboardEntry[]> {
  return request<LeaderboardEntry[]>('/v1/games/leaderboard/total');
}

// ── Notifications (колокольчик) ────────────────────────────────────────
export interface NotificationDto {
  id: number;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListDto {
  items: NotificationDto[];
  unread: number;
}

export function fetchNotifications(): Promise<NotificationListDto> {
  return request<NotificationListDto>('/v1/notifications/');
}

export function markNotificationsRead(): Promise<{ status: string }> {
  return request<{ status: string }>('/v1/notifications/read-all', { method: 'POST' });
}

// ── API-ключи (для разработчиков) ───────────────────────────────────────────────
export function createApiKey(name: string): Promise<ApiKeyCreatedResponse> {
  return request<ApiKeyCreatedResponse>('/v1/api-keys/', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function listApiKeys(): Promise<ApiKeyInfo[]> {
  return request<ApiKeyInfo[]>('/v1/api-keys/');
}

export async function revokeApiKey(keyId: number): Promise<void> {
  const response = await apiFetch(`/v1/api-keys/${keyId}`, { method: 'DELETE' });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
    throw new ApiError(response.status, errorBody.detail || `API error: ${response.status}`);
  }
  // 204 No Content — тела ответа нет
}

// ── Консультант (RBAC) ──────────────────────────────────────────────────
export function getConsultantClients(): Promise<ClientInfo[]> {
  return request<ClientInfo[]>('/v1/consultant/clients');
}

export function getClientTransactions(
  clientId: number,
  limit = 20,
  offset = 0,
): Promise<TransactionPaginatedResponse> {
  return request<TransactionPaginatedResponse>(
    `/v1/consultant/clients/${clientId}/transactions?limit=${limit}&offset=${offset}`,
  );
}
