import { displayWidth, splitGraphemes } from './lexer/graphemes.ts';

export type ErrorKind = 'lexicale' | 'syntaxe' | 'sémantique' | 'exécution';

export interface Position {
  readonly line: number;
  readonly col: number;
}

/** Une erreur prête à être affichée (compilation ou exécution). */
export interface Diagnostic extends Position {
  readonly kind: ErrorKind;
  readonly message: string;
  /** Nombre de graphèmes à souligner (0 = pas de position connue). */
  readonly width: number;
}

export class MojitoError extends Error implements Diagnostic {
  readonly kind: ErrorKind;
  readonly line: number;
  readonly col: number;
  readonly width: number;

  constructor(kind: ErrorKind, message: string, position: Position, width = 1) {
    super(message);
    this.name = 'MojitoError';
    this.kind = kind;
    this.line = position.line;
    this.col = position.col;
    this.width = width;
  }
}

const KIND_LABELS: Readonly<Record<ErrorKind, string>> = {
  lexicale: '🔤 Erreur lexicale',
  syntaxe: '🧱 Erreur de syntaxe',
  sémantique: '🧠 Erreur sémantique',
  exécution: "💥 Erreur d'exécution",
};

function describeLocation(diagnostic: Diagnostic, fileName: string | undefined): string {
  const file = fileName ?? '<source>';
  return diagnostic.line > 0 ? `${file}:${diagnostic.line}:${diagnostic.col}` : file;
}

function caretLine(lineText: string, col: number, width: number): string {
  const graphemes = splitGraphemes(lineText);
  const before = graphemes.slice(0, col - 1).reduce((sum, g) => sum + displayWidth(g), 0);
  const underlined = graphemes
    .slice(col - 1, col - 1 + Math.max(width, 1))
    .reduce((sum, g) => sum + displayWidth(g), 0);
  return ' '.repeat(before) + '^'.repeat(Math.max(underlined, 1));
}

/** Met en forme un diagnostic avec un extrait du code source et un soulignement. */
export function formatDiagnostic(diagnostic: Diagnostic, source: string, fileName?: string): string {
  const header = `${KIND_LABELS[diagnostic.kind]} — ${describeLocation(diagnostic, fileName)}`;
  const lines = source.split(/\r\n|\r|\n/);
  const lineText = diagnostic.line > 0 ? lines[diagnostic.line - 1] : undefined;
  if (lineText === undefined) {
    return `${header}\n  👉 ${diagnostic.message}`;
  }
  const gutter = String(diagnostic.line);
  const pad = ' '.repeat(gutter.length);
  return [
    header,
    ` ${gutter} │ ${lineText}`,
    ` ${pad} │ ${caretLine(lineText, diagnostic.col, diagnostic.width)}`,
    `  👉 ${diagnostic.message}`,
  ].join('\n');
}
