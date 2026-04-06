/**
 * Contract-First TypeScript types — mirrored from Pydantic V2 schemas.
 * Single Source of Truth for frontend ↔ backend DTO alignment.
 *
 * Source: backend/src/schemas/
 */

// ── User ──────────────────────────────────────────────────────────────
export interface UserRead {
  id: number;
  email: string;
  full_name: string | null;
  phone: string | null;
  monthly_income: number | null;
}

export interface UserUpdate {
  full_name?: string | null;
  phone?: string | null;
  monthly_income?: number | null;
}

// ── Transaction ────────────────────────────────────────────────────────
export interface TransactionCreate {
  category_id: number;
  amount: number;
  currency?: string;
  executed_at: string; // ISO 8601
  entry_type?: string;
  comment?: string;
}

export interface TransactionResponse {
  id: number;
  user_id: number;
  category_id: number;
  category_name?: string;
  amount: number | string;
  currency: string;
  is_recurring: boolean;
  entry_type: string;
  executed_at: string;
  idempotency_key: string | null;
  comment?: string;
}

// ── Dashboard Matrix ───────────────────────────────────────────────────
export interface DayCellSchema {
  day: number; // 1–31
  amount: string;
}

export interface CategoryRowSchema {
  category_id: number;
  category_name: string;
  type?: string;
  planned: string;
  fact: string;
  delta: string;
  days: DayCellSchema[]; // exactly 31 items
}

export interface DashboardResponse {
  start_date?: string;
  end_date?: string;
  total_balance_all_time: string;
  period_income: string;
  period_expense: string;
  rows: CategoryRowSchema[];
}

// ── LLM Insights ───────────────────────────────────────────────────────
export interface InsightRequest {
  year: number;
}

export interface InsightEnqueueResponse {
  task_id: string;
  status: 'pending';
}

export interface InsightResultResponse {
  task_id: string;
  status: 'pending' | 'complete';
  result: InsightResult | null;
}

export interface InsightResult {
  user_id: number;
  year: number;
  generated_at: string;
  insight: string;
  summary: {
    total_income: string;
    total_expense: string;
    savings_rate: string;
    top_expense_category: string;
    top_growth_category: string;
  };
}

// ── Sidebar Navigation ────────────────────────────────────────────────
export interface NavItem {
  label: string;
  icon: string;
  active?: boolean;
}

// ── Account Summary ───────────────────────────────────────────────────
export interface AccountBalance {
  name: string;
  amount: number;
  color: string;
}

export interface MonthlySummaryData {
  totalIn: number;
  totalOut: number;
  inChange: number;
  outChange: number;
  dailyData: { day: number; income: number; expense: number }[];
}

// ── Analytics & Simulation ────────────────────────────────────────────
export interface CategoryAvg {
  category_id: number;
  name: string;
  avg_amount: string; // Decimal
}

export interface AnalyticsProfileResponse {
  categories: CategoryAvg[];
  avg_income: string; // Decimal
}

export interface Adjustment {
  category_id: number;
  new_amount: string;
}

export interface SimulateRequest {
  target_amount: string;
  initial_savings: string;
  adjustments: Adjustment[];
  bank_rate: string;
  avg_income: string;
  base_expenses: CategoryAvg[];
  habit_savings?: string;
}

export interface SimulationDataPoint {
  month: string;
  base_savings: number;
  optimized_savings: number;
}

export interface SimulateResponse {
  base_target_date: string | null;
  optimized_target_date: string | null;
  days_saved?: number;
  chart_data: SimulationDataPoint[];
}

// ── Category ──────────────────────────────────────────────────────────
export interface CategoryRead {
  id: number;
  name: string;
  type: string;
  icon?: string;
  parent_id?: number;
}

// ── Recurring Reminder (Frontend-managed) ─────────────────────────────
export interface RecurringReminder {
  id: string;
  title: string;
  amount: number;
  currency: string;
  categoryId: number;
  categoryName: string;
  dueDate: string; // ISO date
  isActive: boolean;
}
