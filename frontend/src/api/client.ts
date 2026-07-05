/**
 * API Client — typed fetch wrappers for the Citrine Vault backend.
 * All responses validated against contract types. Zero `any` types in public API.
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

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
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
    throw new ApiError(response.status, errorBody.detail || `API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// ── Telegram Integration ──────────────────────────────────────────────
export function generateTelegramOtp(): Promise<TelegramOtpResponse> {
  return request<TelegramOtpResponse>('/v1/users/telegram-link', {
    method: 'POST',
  });
}

// ── Transactions ───────────────────────────────────────────────────────
export function createTransaction(
  payload: TransactionCreate,
  idempotencyKey?: string,
): Promise<TransactionResponse> {
  const headers: Record<string, string> = {};
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  // 1. Convert amount to string to satisfy strict Pydantic V2 Decimal validation
  // 2. Safely replace 'Z' with '+00:00' for Python <3.11 isoformat compat
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
  // 204 No Content — no body to parse
}

// ── Dashboard ──────────────────────────────────────────────────────────
export function fetchDashboard(startDate: string, endDate: string): Promise<DashboardResponse> {
  return request<DashboardResponse>(`/v1/dashboard/?start_date=${startDate}&end_date=${endDate}`);
}

// ── LLM Insights ───────────────────────────────────────────────────────
export function enqueueInsight(body: InsightRequest): Promise<InsightEnqueueResponse> {
  return request<InsightEnqueueResponse>('/v1/insights/', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function pollInsight(taskId: string): Promise<InsightResultResponse> {
  return request<InsightResultResponse>(`/v1/insights/${taskId}`);
}

// ── Analytics & Simulation ─────────────────────────────────────────────
export function fetchAnalyticsProfile(): Promise<AnalyticsProfileResponse> {
  return request<AnalyticsProfileResponse>('/v1/analytics/profile');
}

export function simulateSavings(body: SimulateRequest): Promise<SimulateResponse> {
  return request<SimulateResponse>('/v1/analytics/simulate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ── Authentication ────────────────────────────────────────────────────
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
    throw new ApiError(response.status, err.detail || 'Ошибка аутентификации');
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

// ── User Profile ──────────────────────────────────────────────────────
export function fetchMe(): Promise<UserRead> {
  return request<UserRead>('/v1/users/me');
}

export function updateMe(payload: UserUpdate): Promise<UserRead> {
  return request<UserRead>('/v1/users/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// ── Categories ────────────────────────────────────────────────────────
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
  // 204 No Content — no body to parse
}

// ── Budgets ───────────────────────────────────────────────────────────
export function upsertBudget(payload: BudgetUpsert): Promise<{ status: string; amount_limit: string }> {
  // Pydantic strictly checks amount format
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

// ── Data Vault: Import / Export ────────────────────────────────────────────

/**
 * Download all user transactions as a CSV file.
 * Creates a hidden <a> element, triggers click, then cleans up.
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
 * Upload a CSV or Excel file for transaction import.
 * Uses FormData — browser auto-sets multipart Content-Type with boundary.
 */
export async function importTransactions(file: File): Promise<ImportResult> {
  // NOTE: Do NOT set Content-Type here — browser must set multipart boundary
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


// ── Bank Offers (Savings Navigator CPA) ────────────────────────────────
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

/** Fire-and-forget funnel counter; 204 has no body so we ignore the response. */
export function clickBankOffer(offerId: number): Promise<void> {
  return apiFetch(`/v1/offers/${offerId}/click`, { method: 'POST' }).then(() => undefined);
}

// ── Latest persisted monthly insight (Cashflow Prophet) ────────────────
export interface LatestInsightDto {
  period_start: string;
  period_end: string;
  advice: string;
  summary: Record<string, unknown>;
  model_used: string;
  created_at: string;
}

export function fetchLatestInsight(): Promise<LatestInsightDto | null> {
  return request<LatestInsightDto | null>('/v1/insights/latest');
}

// ── Feedback ───────────────────────────────────────────────────────────
export function submitFeedback(message: string): Promise<{ status: string }> {
  return request<{ status: string }>('/v1/feedback/', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

// ── API Keys (Developer) ───────────────────────────────────────────────
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
  // 204 No Content — no body to parse
}

// ── Consultant (RBAC) ──────────────────────────────────────────────────
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
