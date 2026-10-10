import { compile } from '../../../src/compiler.ts';
import { formatDiagnostic, type Diagnostic } from '../../../src/errors.ts';
import type { NumberStyle } from '../../../src/runtime/runtime.ts';
import { applyInput } from './line-editor.ts';
import { startProgram, type ProgramOutcome, type RunningProgram } from './program-host.ts';

/**
 * Une exécution de programme dans le terminal Mojito : compile, lance le
 * worker, relaie la sortie, gère la saisie 🎤 (avec frappe anticipée) et Ctrl+C.
 * Ne dépend pas de l'API VS Code : extension.ts la branche sur un Pseudoterminal.
 */

export type SessionEnd = ProgramOutcome | { readonly kind: 'not-compiled' };

export interface SessionOptions {
  readonly workerPath: string;
  readonly source: string;
  readonly fileName: string;
  readonly numberStyle: NumberStyle;
  /** Reçoit le texte prêt pour le terminal (fins de ligne \r\n, couleurs ANSI). */
  readonly write: (text: string) => void;
  readonly onEnd?: (end: SessionEnd) => void;
}

export interface Session {
  readonly open: () => void;
  readonly close: () => void;
  readonly handleInput: (data: string) => void;
}

const ESC = String.fromCharCode(27);
const RED = `${ESC}[31m`;
const DIM = `${ESC}[2m`;
const RESET = `${ESC}[0m`;

export function toTerminal(text: string): string {
  return text.replace(/\r?\n/g, '\r\n');
}

function describeErrors(errors: readonly Diagnostic[], source: string, fileName: string): string {
  return errors.map((error) => formatDiagnostic(error, source, fileName)).join('\n\n');
}

export function describeOutcome(outcome: ProgramOutcome, source: string, fileName: string): string {
  switch (outcome.kind) {
    case 'finished':
      return outcome.errors.length === 0
        ? `${DIM}✅ Programme terminé.${RESET}`
        : `${RED}${describeErrors(outcome.errors, source, fileName)}${RESET}`;
    case 'stopped':
      return `${DIM}⏹️ Programme arrêté.${RESET}`;
    case 'crashed':
      return `${RED}💥 Erreur interne : ${outcome.message}${RESET}`;
  }
}

export function createSession(options: SessionOptions): Session {
  return new ProgramSession(options);
}

class ProgramSession implements Session {
  private readonly options: SessionOptions;
  private readonly queued: (string | null)[] = [];
  private program: RunningProgram | undefined;
  private line = '';
  private waiting = false;
  private atLineStart = true;

  constructor(options: SessionOptions) {
    this.options = options;
  }

  readonly open = (): void => {
    const { source, fileName } = this.options;
    this.print(`${DIM}▶ ${fileName}  (Ctrl+C pour arrêter)${RESET}\n`);
    const compiled = compile(source);
    if (!compiled.ok) {
      this.footer(`${RED}${describeErrors(compiled.errors, source, fileName)}${RESET}`);
      this.options.onEnd?.({ kind: 'not-compiled' });
      return;
    }
    this.program = startProgram(this.options.workerPath, compiled.js, this.options.numberStyle, {
      onOutput: (text) => this.print(text),
      onInputRequest: () => {
        this.waiting = true;
        this.deliver();
      },
      onExit: (outcome) => {
        this.program = undefined;
        this.footer(describeOutcome(outcome, source, fileName));
        this.options.onEnd?.(outcome);
      },
    });
  };

  readonly close = (): void => {
    this.program?.stop();
  };

  readonly handleInput = (data: string): void => {
    if (this.program === undefined) {
      return;
    }
    const result = applyInput(this.line, data);
    this.line = result.text;
    if (result.echo !== '') {
      this.options.write(result.echo);
      this.atLineStart = result.echo.endsWith('\n');
    }
    for (const event of result.events) {
      if (event.kind === 'interrupt') {
        this.program?.stop();
        return;
      }
      this.queued.push(event.kind === 'line' ? event.text : null);
    }
    this.deliver();
  };

  /** Transmet la prochaine ligne tapée dès que le programme en demande une. */
  private deliver(): void {
    if (this.waiting && this.queued.length > 0) {
      this.waiting = false;
      this.program?.submit(this.queued.shift() ?? null);
    }
  }

  private print(text: string): void {
    if (text !== '') {
      this.options.write(toTerminal(text));
      this.atLineStart = text.endsWith('\n');
    }
  }

  private footer(text: string): void {
    this.print(`${this.atLineStart ? '' : '\n'}${text}\n`);
  }
}
