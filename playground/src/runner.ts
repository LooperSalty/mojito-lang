import { compile, type CompileResult } from '../../src/compiler.ts';
import { formatDiagnostic, type Diagnostic } from '../../src/errors.ts';
import { executeCompiled, executeInterpreted, type Engine } from '../../src/execute.ts';
import { tokenize } from '../../src/lexer/lexer.ts';
import type { NumberStyle } from '../../src/runtime/runtime.ts';

/** Garde-fou pour ne jamais figer l'onglet du navigateur. */
const MAX_STEPS = 2_000_000;
const FILE_NAME = 'programme.emoji';

export interface OutputChunk {
  readonly text: string;
  readonly isError: boolean;
}

export interface RunReport {
  readonly chunks: readonly OutputChunk[];
  readonly engine: Engine;
  readonly durationMs: number;
}

/** La page peut-elle évaluer du JavaScript (dépend de sa politique de sécurité) ? */
export function detectEngine(): Engine {
  try {
    return new Function('return true')() === true ? 'compiled' : 'interpreter';
  } catch {
    return 'interpreter';
  }
}

export function describeErrors(errors: readonly Diagnostic[], source: string): string {
  return errors.map((error) => formatDiagnostic(error, source, FILE_NAME)).join('\n\n');
}

export function tokensTable(source: string): string {
  try {
    return tokenize(source)
      .map((token) => `${`${token.line}:${token.col}`.padEnd(7)} ${token.type.padEnd(9)} ${token.lexeme}`)
      .join('\n');
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export function runProgram(
  compiled: CompileResult,
  source: string,
  inputs: readonly string[],
  numberStyle: NumberStyle,
  engine: Engine,
): RunReport {
  const started = performance.now();
  if (!compiled.ok) {
    return { chunks: [{ text: describeErrors(compiled.errors, source), isError: true }], engine, durationMs: 0 };
  }
  const written: string[] = [];
  const pending = [...inputs];
  const io = {
    write: (text: string) => {
      written.push(text);
    },
    readLine: () => pending.shift() ?? null,
    random: Math.random,
  };
  const options = { io, numberStyle, maxSteps: MAX_STEPS };
  const result = engine === 'compiled' ? executeCompiled(compiled.js, options) : executeInterpreted(compiled, options);
  const chunks: OutputChunk[] = [{ text: written.join(''), isError: false }];
  if (!result.ok) {
    chunks.push({ text: describeErrors(result.errors, source), isError: true });
  }
  return { chunks, engine, durationMs: performance.now() - started };
}

export { compile };
