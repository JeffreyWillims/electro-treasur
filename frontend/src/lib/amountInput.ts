// frontend/src/lib/amountInput.ts
// Умный разбор поля суммы: «1.5к» → 1500, «250+180» → 430, «2×3» → 6.
// Свой рекурсивный парсер (+ − × ÷ и скобки) — без eval, поэтому ввод
// пользователя никогда не исполняется как код.

// Разрешённые символы поля (до вычисления): цифры, разделители, операторы,
// суффиксы тысяч. Всё остальное вычищается на вводе.
export const AMOUNT_ALLOWED = /[^0-9.,+\-*/×÷кk() ]/gi;

class Parser {
  private i = 0;
  constructor(private readonly s: string) {}

  parse(): number | null {
    const v = this.add();
    return this.i === this.s.length ? v : null; // хвостовой мусор → невалидно
  }

  private add(): number | null {
    let left = this.mul();
    if (left === null) return null;
    while (this.s[this.i] === '+' || this.s[this.i] === '-') {
      const op = this.s[this.i++];
      const right = this.mul();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  private mul(): number | null {
    let left = this.unary();
    if (left === null) return null;
    while (this.s[this.i] === '*' || this.s[this.i] === '/') {
      const op = this.s[this.i++];
      const right = this.unary();
      if (right === null) return null;
      if (op === '/' && right === 0) return null;
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  private unary(): number | null {
    if (this.s[this.i] === '-') {
      this.i++;
      const v = this.unary();
      return v === null ? null : -v;
    }
    if (this.s[this.i] === '+') {
      this.i++;
      return this.unary();
    }
    return this.primary();
  }

  private primary(): number | null {
    if (this.s[this.i] === '(') {
      this.i++;
      const v = this.add();
      if (v === null || this.s[this.i] !== ')') return null;
      this.i++;
      return v;
    }
    const start = this.i;
    while (this.i < this.s.length && /[0-9.]/.test(this.s[this.i]!)) this.i++;
    if (this.i === start) return null;
    const num = Number(this.s.slice(start, this.i));
    return Number.isFinite(num) ? num : null;
  }
}

/**
 * Вычисляет строку-выражение в число рублей или null, если ввод бессмысленный.
 * Понимает «к»/«k»/«тыс» как ×1000, × и ÷, запятую как десятичную точку.
 */
export function evalAmountExpression(input: string): number | null {
  if (!input) return null;
  let s = input.toLowerCase().replace(/\s+/g, '');
  s = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '.');
  // «1.5к» → «1.5*1000» (суффикс тысяч после числа)
  s = s.replace(/(\d(?:\.\d+)?)(к|k|тыс\.?)/g, '$1*1000');
  if (!/^[0-9.+\-*/()]+$/.test(s)) return null;
  const val = new Parser(s).parse();
  if (val === null || !Number.isFinite(val)) return null;
  return Math.round(val * 100) / 100;
}

/** Число → «1 500» / «99.90» (группировка разрядов, .00 отбрасывается). */
export function formatAmount(n: number): string {
  const [int, frac] = n.toFixed(2).split('.');
  const grouped = (int ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return frac && frac !== '00' ? `${grouped}.${frac}` : grouped;
}

/**
 * Живое форматирование при вводе: простое число группируем сразу, а выражение
 * (есть оператор/суффикс) оставляем как есть — посчитаем на blur.
 */
export function sanitizeAmountInput(raw: string): string {
  const cleaned = raw.replace(AMOUNT_ALLOWED, '');
  if (/^[\d\s]*[.,]?\d*$/.test(cleaned)) {
    const norm = cleaned.replace(/\s/g, '').replace(',', '.');
    const parts = norm.split('.');
    const intPart = (parts[0] ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts.length > 1 ? `${intPart}.${(parts[1] ?? '').slice(0, 2)}` : intPart;
  }
  return cleaned;
}
