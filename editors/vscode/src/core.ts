import { compile } from '../../../src/compiler.ts';
import type { Diagnostic } from '../../../src/errors.ts';
import { canonical, splitGraphemes } from '../../../src/lexer/graphemes.ts';
import { tokenize } from '../../../src/lexer/lexer.ts';
import { KEYWORD_SPECS, type KeywordSpec, type Token } from '../../../src/lexer/tokens.ts';

/**
 * Logique de l'extension VS Code indépendante de l'API `vscode` (donc testable).
 * VS Code compte les positions en unités UTF-16 à partir de 0 ; Mojito compte
 * en graphèmes à partir de 1 (un emoji = une colonne). Ces fonctions convertissent.
 */

export interface LineRange {
  /** Ligne, à partir de 0. */
  readonly line: number;
  /** Début et fin en unités UTF-16, à partir de 0. */
  readonly start: number;
  readonly end: number;
}

export interface EditorProblem {
  readonly range: LineRange;
  readonly message: string;
  readonly kind: Diagnostic['kind'];
}

export interface HoverInfo {
  readonly markdown: string;
  readonly range: LineRange;
}

export function splitLines(source: string): readonly string[] {
  return source.split(/\r\n|\r|\n/);
}

/** Colonne Mojito (graphèmes, depuis 1) → position VS Code (UTF-16, depuis 0). */
export function graphemeColumnToOffset(lineText: string, col: number): number {
  return splitGraphemes(lineText)
    .slice(0, Math.max(col - 1, 0))
    .reduce((sum, grapheme) => sum + grapheme.length, 0);
}

/** Position VS Code (UTF-16, depuis 0) → colonne Mojito (graphèmes, depuis 1). */
export function offsetToGraphemeColumn(lineText: string, offset: number): number {
  let consumed = 0;
  const graphemes = splitGraphemes(lineText);
  for (const [index, grapheme] of graphemes.entries()) {
    consumed += grapheme.length;
    if (offset < consumed) {
      return index + 1;
    }
  }
  return graphemes.length + 1;
}

export function diagnosticRange(diagnostic: Diagnostic, lines: readonly string[]): LineRange {
  if (diagnostic.line <= 0) {
    return { line: 0, start: 0, end: (lines[0] ?? '').length };
  }
  const line = Math.min(diagnostic.line, lines.length) - 1;
  const text = lines[line] ?? '';
  const start = graphemeColumnToOffset(text, diagnostic.col);
  const end = graphemeColumnToOffset(text, diagnostic.col + Math.max(diagnostic.width, 1));
  return { line, start, end };
}

/** Erreurs de compilation à souligner dans l'éditeur. */
export function problemsFor(source: string): readonly EditorProblem[] {
  const result = compile(source);
  if (result.ok) {
    return [];
  }
  const lines = splitLines(source);
  return result.errors.map((error) => ({
    range: diagnosticRange(error, lines),
    message: error.message,
    kind: error.kind,
  }));
}

const SPECS_BY_FORM: ReadonlyMap<string, KeywordSpec> = new Map(
  KEYWORD_SPECS.map((spec) => [splitGraphemes(spec.emoji).map(canonical).join(''), spec]),
);

const USAGE: Partial<Readonly<Record<KeywordSpec['type'], string>>> = {
  LET: '📦 🍎 ⬅️ 4️⃣2️⃣',
  CONST: '🔒 🍋 ⬅️ 💬citron💬',
  PRINT: '📢 🍎 🔸 💬texte💬',
  INPUT: '📦 📝 ⬅️ 🎤',
  IF: '🤔 🍎 🔼 🔟\n  📢 💬grand💬\n🙃\n  📢 💬petit💬\n🔚',
  WHILE: '🔁 🍎 🔼 0️⃣\n  🍎 ⬅️ 🍎 ➖ 1️⃣\n🔚',
  FOR: '🔂 🐝 📥 1️⃣ ➡️ 🔟\n  📢 🐝\n🔚',
  FUNC: '🧩 🍰 👉 🅰️ 🔸 🅱️ 👈\n  ↩️ 🅰️ ➕ 🅱️\n🔚',
  LBRACKET: '📦 📋 ⬅️ 🌜 1️⃣ 🔸 2️⃣ 🌛\n📢 📋🌜0️⃣🌛',
  RANGE: '🔂 🐝 📥 1️⃣ ➡️ 5️⃣ … 🔚',
  RANDOM: '📦 🎯 ⬅️ 🎲 💯 ➕ 1️⃣',
};

function describeToken(token: Token): string | null {
  switch (token.type) {
    case 'NUMBER':
      return `**${token.lexeme}** — nombre ${String(token.value)}`;
    case 'STRING':
      return `**💬 texte 💬** — ${splitGraphemes(String(token.value)).length} symbole(s)`;
    case 'IDENT':
      return `**${token.lexeme}** — nom choisi par toi (variable, constante, paramètre ou fonction)`;
    case 'EOF':
      return null;
    default: {
      const spec = SPECS_BY_FORM.get(splitGraphemes(token.lexeme).map(canonical).join(''));
      if (spec === undefined) {
        return null;
      }
      const usage = USAGE[spec.type];
      const example = usage === undefined ? '' : `\n\n\`\`\`mojito\n${usage}\n\`\`\``;
      return `**${spec.emoji} ${spec.meaning}** — ${spec.category}${example}`;
    }
  }
}

/** Explication de l'emoji sous le curseur (null en dehors d'un jeton ou si le code ne se découpe pas). */
export function hoverAt(source: string, line: number, offset: number): HoverInfo | null {
  let tokens: readonly Token[];
  try {
    tokens = tokenize(source);
  } catch {
    return null;
  }
  const lineText = splitLines(source)[line] ?? '';
  const col = offsetToGraphemeColumn(lineText, offset);
  const token = tokens.find(
    (candidate) => candidate.line === line + 1 && candidate.endLine === line + 1 && col >= candidate.col && col < candidate.col + candidate.width,
  );
  const markdown = token === undefined ? null : describeToken(token);
  if (token === undefined || markdown === null) {
    return null;
  }
  const start = graphemeColumnToOffset(lineText, token.col);
  return { markdown, range: { line, start, end: graphemeColumnToOffset(lineText, token.col + token.width) } };
}

/** Seuls les fichiers locaux et les brouillons sont analysés (pas les copies git: d'un diff). */
export function isEditableScheme(scheme: string): boolean {
  return scheme === 'file' || scheme === 'untitled';
}

export const NEW_PROGRAM = [
  '💭 Mon programme Mojito 🍹 — enregistre-le avec l’extension .emoji',
  '📦 🍎 ⬅️ 4️⃣0️⃣',
  '📦 🍌 ⬅️ 2️⃣',
  '📢 💬👋 🌍💬',
  '📢 🍎 ➕ 🍌',
  '',
].join('\n');
