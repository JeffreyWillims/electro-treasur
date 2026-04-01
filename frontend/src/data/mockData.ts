/**
 * Mock data — simulates REST API responses for development.
 * All monetary values as strings (Decimal contract).
 */
import type { CategoryRowSchema, MonthlySummaryData, AccountBalance } from '@/types';

export const ACCOUNTS: AccountBalance[] = [
  { name: 'Основной счет', amount: 125000.00, color: '#3b82f6' },
  { name: 'Сбережения', amount: 450000.00, color: '#10b981' },
  { name: 'Наличные', amount: 15000.00, color: '#8b5cf6' },
];

export const TOTAL_BALANCE = 590000.00;
export const MONTHLY_INCOME = 184200.00;
export const MONTHLY_EXPENSE = 156732.00;

export const MONTHLY_SUMMARY: MonthlySummaryData = {
  totalIn: 1450.34,
  totalOut: 3402.22,
  inChange: -2.5,
  outChange: 5.4,
  dailyData: Array.from({ length: 31 }, (_, i) => ({
    day: i + 1,
    income: Math.round(Math.random() * 300 + 50),
    expense: Math.round(Math.random() * 500 + 100),
  })),
};

export const BUDGET_ROWS: CategoryRowSchema[] = [
  {
    category_id: 1,
    category_name: 'Ипотека',
    planned: '24897.54',
    fact: '24897.54',
    delta: '0.00',
    days: Array.from({ length: 31 }, (_, i) => ({
      day: i + 1,
      amount: i === 4 ? '24897.54' : '0.00',
    })),
  },
  {
    category_id: 2,
    category_name: 'Продукты',
    planned: '18000.00',
    fact: '15320.45',
    delta: '2679.55',
    days: Array.from({ length: 31 }, (_, i) => ({
      day: i + 1,
      amount: (Math.random() * 800).toFixed(2),
    })),
  },
  {
    category_id: 3,
    category_name: 'Транспорт',
    planned: '5000.00',
    fact: '4230.00',
    delta: '770.00',
    days: Array.from({ length: 31 }, (_, i) => ({
      day: i + 1,
      amount: i % 3 === 0 ? (Math.random() * 500).toFixed(2) : '0.00',
    })),
  },
  {
    category_id: 4,
    category_name: 'Подписки',
    planned: '3200.00',
    fact: '3200.00',
    delta: '0.00',
    days: Array.from({ length: 31 }, (_, i) => ({
      day: i + 1,
      amount: i === 0 ? '3200.00' : '0.00',
    })),
  },
  {
    category_id: 5,
    category_name: 'Развлечения',
    planned: '8000.00',
    fact: '9540.30',
    delta: '-1540.30',
    days: Array.from({ length: 31 }, (_, i) => ({
      day: i + 1,
      amount: i % 4 === 0 ? (Math.random() * 600).toFixed(2) : '0.00',
    })),
  },
];

export const CATEGORY_PIE_DATA = [
  { name: 'Жилье', value: 45, color: '#8b5cf6' },
  { name: 'Продукты', value: 25, color: '#3b82f6' },
  { name: 'Здоровье', value: 15, color: '#10b981' },
  { name: 'Транспорт', value: 10, color: '#f59e0b' },
  { name: 'Прочее', value: 5, color: '#f43f5e' },
];

export const LAST_TRANSACTIONS = [
  {
    id: 1,
    name: 'Подписка Netflix',
    detail: 'Основной счет (...4412)',
    outgoing: '1,499.00 ₽',
    incoming: '—',
  },
  {
    id: 2,
    name: 'Зарплата',
    detail: 'Основной счет (...4412)',
    outgoing: '—',
    incoming: '184,200.00 ₽',
  },
];
