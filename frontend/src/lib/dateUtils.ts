/**
 * dateUtils.ts — MSK (UTC+3) Enforced Time Module
 */

// 1. Получаем текущую дату и время СТРОГО по Москве
export function getMoscowDate(): Date {
  const now = new Date();
  // Переводим текущее системное время в строку московского времени
  const mskString = now.toLocaleString("en-US", { timeZone: "Europe/Moscow" });
  // Возвращаем объект Date, который думает, что он в Москве
  return new Date(mskString);
}

// 2. Форматируем любую дату в строку формата YYYY-MM-DD
export function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}