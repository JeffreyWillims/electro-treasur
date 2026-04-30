/**
 * API Client — typed fetch wrappers for the Citrine Vault backend.
 * All responses validated against contract types. Zero `any` types in public API.
 *
 * Authorization: JWT Bearer tokens from localStorage('aura_token').
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
  UserRead,
  UserUpdate,
  BudgetUpsert,
} from '@/types';

const API_BASE = '/api';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  // ── Authorization Interceptor ───────────────────────────────────────
  const token = localStorage.getItem('aura_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const mergedOptions = {
    ...options,
    headers: {
      ...headers,
      ...(options?.headers as Record<string, string>),
    },
  };

  const response = await fetch(`${API_BASE}${url}`, mergedOptions);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
    throw new ApiError(response.status, errorBody.detail || `API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
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
  const token = localStorage.getItem('aura_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/v1/transactions/${id}`, {
    method: 'DELETE',
    headers,
  });

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
export function login(username: string, password: string): Promise<{ access_token: string; token_type: string }> {
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);

  return fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData,
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new ApiError(res.status, err.detail || 'Ошибка аутентификации');
    }
    return res.json();
  });
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

export function deleteBudget(categoryId: number, month: number, year: number): Promise<void> {
  const token = localStorage.getItem('aura_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return fetch(`${API_BASE}/v1/budgets/${categoryId}?month=${month}&year=${year}`, {
    method: 'DELETE',
    headers,
  }).then(async (response) => {
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
      throw new ApiError(response.status, errorBody.detail || `API error: ${response.status}`);
    }
  });
}
