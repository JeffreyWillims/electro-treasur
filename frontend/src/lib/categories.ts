// src/lib/categories.ts
const CATEGORY_TRANSLATIONS: Record<string, string> = {
  "Operations (Rent/Utility)": "Базовые расходы",
  "Leisure (Lifestyle)": "Лайфстайл",
  "Wellness (Health)": "Здоровье и Уход",
  "Propulsion (Income)": "Поступления",
  "Growth (Investments)": "Инвестиции",
  "Income": "Доход",
};

export function getRussianCategoryName(rawName: string): string {
  if (!rawName) return "Без категории";
  if (CATEGORY_TRANSLATIONS[rawName]) return CATEGORY_TRANSLATIONS[rawName];

  const name = rawName.toLowerCase();
  if (name.includes('leisure') || name.includes('lifestyle')) return 'Лайфстайл';
  if (name.includes('housing')) return 'Жилье';
  if (name.includes('transport') || name.includes('logistics')) return 'Транспорт';
  if (name.includes('food')) return 'Продукты';
  if (name.includes('health') || name.includes('wellness')) return 'Здоровье';
  if (name.includes('income') || name.includes('propulsion')) return 'Доход';
  if (name.includes('shopping')) return 'Покупки';
  if (name.includes('utilit') || name.includes('operation')) return 'ЖКХ и Операции';
  if (name.includes('growth') || name.includes('invest')) return 'Инвестиции';
  return rawName;
}