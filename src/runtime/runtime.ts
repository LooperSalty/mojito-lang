/**
 * Bibliothèque d'exécution de Mojito.
 *
 * ⚠️ `createRuntime` doit rester AUTONOME (aucune référence à un import ou à
 * une variable du module) : son code source est recopié tel quel dans les
 * programmes compilés par `mojito build` via `createRuntime.toString()`.
 */

export type MojitoValue = number | string | boolean | null | MojitoValue[] | MojitoFunction;
export type MojitoFunction = (...args: MojitoValue[]) => MojitoValue | undefined;

export interface RuntimeIO {
  readonly write: (text: string) => void;
  /** Renvoie la ligne lue (sans le saut de ligne) ou null en fin d'entrée. */
  readonly readLine: () => string | null;
  /** Nombre aléatoire dans [0, 1[. */
  readonly random: () => number;
}

export type NumberStyle = 'emoji' | 'ascii';

export interface RuntimeOptions {
  readonly numberStyle: NumberStyle;
  /** Nombre maximal de tours de boucle avant d'abandonner (0 = illimité). */
  readonly maxSteps: number;
}

export interface RuntimeDiagnostic {
  readonly message: string;
  readonly line: number;
  readonly col: number;
}

export type Runtime = ReturnType<typeof createRuntime>;

export function createRuntime(io: RuntimeIO, options: RuntimeOptions) {
  class MojitoRuntimeError extends Error {
    readonly line: number;
    readonly col: number;

    constructor(message: string, position: string) {
      super(message);
      const [line, col] = position.split(':').map(Number);
      this.line = line ?? 0;
      this.col = col ?? 0;
    }
  }

  const MAX_ITEMS = 10_000_000;
  const KEYCAPS = Array.from({ length: 10 }, (_, digit) => `${digit}\uFE0F\u20E3`);
  const SYMBOLS: Readonly<Record<string, string>> = { '-': '➖', '.': '⏺️', '+': '➕', e: '🇪' };
  const NUMERIC = /^-?\d+(\.\d+)?(e[+-]?\d+)?$/;
  const MANGLED_NAME = /_[0-9a-f]+(?:_[0-9a-f]+)*(?:\$\d+)?/;
  const segmenter = new Intl.Segmenter('fr', { granularity: 'grapheme' });
  const callSites = new WeakMap<object, string>();
  let steps = 0;

  const fail = (message: string, position: string): never => {
    throw new MojitoRuntimeError(message, position);
  };

  const graphemes = (text: string): string[] => Array.from(segmenter.segment(text), (part) => part.segment);

  const formatNumber = (value: number): string => {
    if (options.numberStyle === 'ascii') return String(value);
    if (Number.isNaN(value)) return '🤯';
    if (!Number.isFinite(value)) return value > 0 ? '♾️' : '➖♾️';
    return Array.from(String(value), (char) => {
      const digit = char.charCodeAt(0) - 48;
      return digit >= 0 && digit <= 9 ? KEYCAPS[digit] : SYMBOLS[char] ?? char;
    }).join('');
  };

  const show = (value: unknown, nested = false, seen: ReadonlySet<unknown> = new Set()): string => {
    if (typeof value === 'number') return formatNumber(value);
    if (typeof value === 'string') return nested ? `💬${value}💬` : value;
    if (value === true) return '✅';
    if (value === false) return '❌';
    if (typeof value === 'function') return '🧩';
    if (Array.isArray(value)) {
      if (seen.has(value)) return '🔁';
      if (value.length === 0) return '🌜🌛';
      const inner = new Set(seen).add(value);
      return `🌜 ${value.map((item) => show(item, true, inner)).join(' 🔸 ')} 🌛`;
    }
    return '🕳️';
  };

  const typeName = (value: unknown): string => {
    if (typeof value === 'number') return 'un nombre 🔢';
    if (typeof value === 'string') return 'un texte 💬';
    if (typeof value === 'boolean') return 'un booléen ✅❌';
    if (Array.isArray(value)) return 'une liste 🌜🌛';
    if (typeof value === 'function') return 'une fonction 🧩';
    return 'rien 🕳️';
  };

  const numbers = (a: unknown, b: unknown, symbol: string, position: string): [number, number] => {
    if (typeof a !== 'number' || typeof b !== 'number') {
      return fail(`Impossible de calculer ${typeName(a)} ${symbol} ${typeName(b)}.`, position);
    }
    return [a, b];
  };

  const nonZero = (divisor: number, position: string): number =>
    divisor === 0 ? fail('Division par zéro ➗0️⃣ : impossible !', position) : divisor;

  const order = (a: unknown, b: unknown, position: string): number => {
    const comparable = (typeof a === 'number' && typeof b === 'number') || (typeof a === 'string' && typeof b === 'string');
    if (!comparable) {
      return fail(`Impossible de comparer ${typeName(a)} et ${typeName(b)}.`, position);
    }
    const [x, y] = [a as number | string, b as number | string];
    if (x < y) return -1;
    return x > y ? 1 : 0;
  };

  const equals = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.length === b.length && a.every((item, i) => equals(item, b[i]));
    }
    return false;
  };

  const tooBig = (): string => `Résultat trop grand (plus de ${formatNumber(MAX_ITEMS)} éléments).`;

  const checkSize = (size: number, position: string): void => {
    if (size > MAX_ITEMS) fail(tooBig(), position);
  };

  const repeat = (sequence: unknown, times: unknown, position: string): MojitoValue => {
    if (typeof times !== 'number' || !Number.isInteger(times) || times < 0) {
      return fail('Pour répéter avec ✖️, il faut un nombre entier positif.', position);
    }
    if (typeof sequence === 'string') {
      checkSize(sequence.length * times, position);
      return sequence.repeat(times);
    }
    const list = sequence as MojitoValue[];
    if (list.length === 0) return [];
    checkSize(list.length * times, position);
    return Array.from({ length: times }, () => list).flat(1);
  };

  const uninitializedMessage = (name: string): string =>
    `${name} est utilisé avant d'avoir reçu sa valeur (la fonction est-elle appelée trop tôt ?).`;

  const slot = (length: number, index: unknown, position: string): number => {
    if (typeof index !== 'number' || !Number.isInteger(index)) {
      return fail(`Un indice 🌜🌛 doit être un nombre entier, pas ${typeName(index)}.`, position);
    }
    const resolved = index < 0 ? length + index : index;
    if (resolved < 0 || resolved >= length) {
      return fail(`L'indice ${formatNumber(index)} est en dehors de la liste (taille ${formatNumber(length)}).`, position);
    }
    return resolved;
  };

  const toAsciiDigit = (grapheme: string): string => {
    const bare = grapheme.replace(/\uFE0F/g, '');
    if (bare.length === 2 && bare[1] === '\u20E3') return bare[0] ?? '';
    if (bare === '➖') return '-';
    if (bare === '➕') return '+';
    if (bare === '⏺') return '.';
    if (bare === '🇪') return 'e';
    return grapheme;
  };

  const demangle = (jsName: string): string => {
    const match = /^_([0-9a-f]+(?:_[0-9a-f]+)*)(?:\$\d+)?$/.exec(jsName);
    if (match === null || match[1] === undefined) return jsName;
    return String.fromCodePoint(...match[1].split('_').map((hex) => parseInt(hex, 16)));
  };

  return {
    show,

    /** Variable lue ou modifiée avant sa déclaration (utilisé par l'interpréteur). */
    uninitialized(name: string, position: string): never {
      return fail(uninitializedMessage(name), position);
    },

    print(values: readonly unknown[]): void {
      io.write(`${values.map((value) => show(value)).join(' ')}\n`);
    },

    str: (value: unknown): string => show(value),

    num(value: unknown): number | null {
      if (typeof value === 'number') return value;
      if (typeof value !== 'string') return null;
      const text = graphemes(value.trim()).map(toAsciiDigit).join('');
      return NUMERIC.test(text) ? Number(text) : null;
    },

    input: (): string | null => io.readLine(),

    add(a: unknown, b: unknown, position: string): MojitoValue {
      if (typeof a === 'number' && typeof b === 'number') return a + b;
      if (typeof a === 'string' || typeof b === 'string') {
        const [left, right] = [show(a), show(b)];
        checkSize(left.length + right.length, position);
        return left + right;
      }
      if (Array.isArray(a) && Array.isArray(b)) {
        checkSize(a.length + b.length, position);
        return [...a, ...b];
      }
      return fail(`Impossible d'additionner ${typeName(a)} et ${typeName(b)}.`, position);
    },

    sub(a: unknown, b: unknown, position: string): number {
      const [x, y] = numbers(a, b, '➖', position);
      return x - y;
    },

    mul(a: unknown, b: unknown, position: string): MojitoValue {
      if (typeof a === 'number' && typeof b === 'number') return a * b;
      if (typeof a === 'string' || Array.isArray(a)) return repeat(a, b, position);
      if (typeof b === 'string' || Array.isArray(b)) return repeat(b, a, position);
      return fail(`Impossible de multiplier ${typeName(a)} par ${typeName(b)}.`, position);
    },

    div(a: unknown, b: unknown, position: string): number {
      const [x, y] = numbers(a, b, '➗', position);
      return x / nonZero(y, position);
    },

    /** Modulo « mathématique » : le résultat a toujours le signe du diviseur. */
    mod(a: unknown, b: unknown, position: string): number {
      const [x, y] = numbers(a, b, '🍕', position);
      const divisor = nonZero(y, position);
      return ((x % divisor) + divisor) % divisor;
    },

    neg(value: unknown, position: string): number {
      return typeof value === 'number' ? -value : fail(`Impossible de rendre négatif ${typeName(value)}.`, position);
    },

    bool(value: unknown, position: string): boolean {
      if (typeof value === 'boolean') return value;
      return fail(`J'attendais une condition ✅ ou ❌, mais j'ai reçu ${typeName(value)} (${show(value)}).`, position);
    },

    eq: equals,
    lt: (a: unknown, b: unknown, position: string): boolean => order(a, b, position) < 0,
    gt: (a: unknown, b: unknown, position: string): boolean => order(a, b, position) > 0,
    le: (a: unknown, b: unknown, position: string): boolean => order(a, b, position) <= 0,
    ge: (a: unknown, b: unknown, position: string): boolean => order(a, b, position) >= 0,

    /** a ➡️ b : entiers de a à b inclus, liste vide si b est plus petit que a. */
    range(from: unknown, to: unknown, position: string): number[] {
      if (typeof from !== 'number' || typeof to !== 'number' || !Number.isInteger(from) || !Number.isInteger(to)) {
        return fail(`Un intervalle ➡️ relie deux nombres entiers, pas ${typeName(from)} et ${typeName(to)}.`, position);
      }
      const size = Math.max(to - from + 1, 0);
      checkSize(size, position);
      return Array.from({ length: size }, (_, i) => from + i);
    },

    len(value: unknown, position: string): number {
      if (typeof value === 'string') return graphemes(value).length;
      if (Array.isArray(value)) return value.length;
      return fail(`📏 mesure une liste ou un texte, pas ${typeName(value)}.`, position);
    },

    rand(limit: unknown, position: string): number {
      if (typeof limit !== 'number' || !Number.isInteger(limit) || limit <= 0) {
        return fail('🎲 attend un nombre entier plus grand que 0️⃣.', position);
      }
      return Math.floor(io.random() * limit);
    },

    index(container: unknown, index: unknown, position: string): MojitoValue {
      if (Array.isArray(container)) return container[slot(container.length, index, position)] as MojitoValue;
      if (typeof container === 'string') {
        const parts = graphemes(container);
        return parts[slot(parts.length, index, position)] as string;
      }
      return fail(`Impossible de prendre un élément 🌜🌛 dans ${typeName(container)}.`, position);
    },

    setIndex(container: unknown, index: unknown, value: MojitoValue, position: string): void {
      if (typeof container === 'string') fail('Un texte 💬 ne se modifie pas case par case.', position);
      if (!Array.isArray(container)) fail(`Impossible de modifier une case 🌜🌛 dans ${typeName(container)}.`, position);
      const list = container as MojitoValue[];
      list[slot(list.length, index, position)] = value;
    },

    iter(value: unknown, position: string): readonly MojitoValue[] {
      if (Array.isArray(value)) return [...value];
      if (typeof value === 'string') return graphemes(value);
      return fail(`🔂 parcourt une liste ou un texte, pas ${typeName(value)}.`, position);
    },

    call(callee: unknown, args: readonly MojitoValue[], position: string): MojitoValue {
      if (typeof callee !== 'function') {
        return fail(`${typeName(callee)} ne s'appelle pas avec 👉👈 : ce n'est pas une fonction 🧩.`, position);
      }
      if (callee.length !== args.length) {
        const expected = `${formatNumber(callee.length)} argument(s)`;
        return fail(`Cette fonction 🧩 attend ${expected}, mais en reçoit ${formatNumber(args.length)}.`, position);
      }
      try {
        const result = (callee as MojitoFunction)(...args);
        return result === undefined ? null : result;
      } catch (error) {
        // Variable lue trop tôt dans le corps : on retient l'appel fautif le plus proche.
        if (error instanceof ReferenceError && !callSites.has(error)) {
          callSites.set(error, position);
        }
        throw error;
      }
    },

    tick(position: string): void {
      if (options.maxSteps <= 0) return;
      steps += 1;
      if (steps > options.maxSteps) {
        fail(`Plus de ${formatNumber(options.maxSteps)} tours de boucle : boucle infinie ? ♾️`, position);
      }
    },

    /** Traduit une exception JavaScript en erreur Mojito lisible (ou null si inconnue). */
    diagnose(error: unknown): RuntimeDiagnostic | null {
      if (error instanceof MojitoRuntimeError) {
        return { message: error.message, line: error.line, col: error.col };
      }
      if (error instanceof Error && /call stack|too much recursion/i.test(error.message)) {
        return { message: "Récursion trop profonde 🌀 : une fonction s'appelle-t-elle sans fin ?", line: 0, col: 0 };
      }
      if (error instanceof RangeError && /invalid (array|string) length/i.test(error.message)) {
        return { message: tooBig(), line: 0, col: 0 };
      }
      if (error instanceof ReferenceError) {
        const emoji = demangle(MANGLED_NAME.exec(error.message)?.[0] ?? '?');
        const [line, col] = (callSites.get(error) ?? '0:0').split(':').map(Number);
        return { message: uninitializedMessage(emoji), line: line ?? 0, col: col ?? 0 };
      }
      return null;
    },
  };
}
