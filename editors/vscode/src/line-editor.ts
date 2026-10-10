import { displayWidth, splitGraphemes } from '../../../src/lexer/graphemes.ts';

/**
 * Édition de la ligne tapée dans le terminal Mojito pendant une lecture 🎤.
 * Le terminal virtuel n'affiche rien tout seul : on renvoie l'écho à écrire.
 */

export type InputEvent =
  | { readonly kind: 'line'; readonly text: string }
  | { readonly kind: 'eof' }
  | { readonly kind: 'interrupt' };

export interface InputResult {
  /** Ligne en cours d'édition après ces touches. */
  readonly text: string;
  /** Ce qu'il faut écrire dans le terminal pour refléter la saisie. */
  readonly echo: string;
  readonly events: readonly InputEvent[];
}

const ESC = String.fromCharCode(27);
const CTRL_C = String.fromCharCode(3);
const CTRL_D = String.fromCharCode(4);
const BACKSPACE = String.fromCharCode(8);
const DELETE = String.fromCharCode(127);
const SPACE = 32;
/** Séquences d'échappement envoyées par les flèches, Origine, etc. : ignorées. */
const ESCAPE_SEQUENCE = new RegExp(`${ESC}(?:\\[[0-9;?]*[ -/]*[@-~]|O.|.)?`, 'g');

function erase(grapheme: string): string {
  const width = displayWidth(grapheme);
  return `${BACKSPACE.repeat(width)}${' '.repeat(width)}${BACKSPACE.repeat(width)}`;
}

export function applyInput(current: string, data: string): InputResult {
  const cleaned = data.replace(ESCAPE_SEQUENCE, '').replace(/\r\n|\n/g, '\r');
  let text = current;
  let echo = '';
  const events: InputEvent[] = [];
  for (const grapheme of splitGraphemes(cleaned)) {
    if (grapheme === '\r') {
      events.push({ kind: 'line', text });
      echo += '\r\n';
      text = '';
    } else if (grapheme === DELETE || grapheme === BACKSPACE) {
      const parts = [...splitGraphemes(text)];
      const last = parts.pop();
      if (last !== undefined) {
        echo += erase(last);
        text = parts.join('');
      }
    } else if (grapheme === CTRL_C) {
      events.push({ kind: 'interrupt' });
      echo += '^C\r\n';
      text = '';
    } else if (grapheme === CTRL_D) {
      if (text === '') {
        events.push({ kind: 'eof' });
        echo += '\r\n';
      }
    } else if (grapheme.charCodeAt(0) >= SPACE) {
      text += grapheme;
      echo += grapheme;
    }
  }
  return { text, echo, events };
}
