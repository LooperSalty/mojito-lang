import { run, type Engine } from '../src/execute.ts';
import type { Diagnostic } from '../src/errors.ts';
import type { NumberStyle, RuntimeIO } from '../src/runtime/runtime.ts';

export interface FakeIOOptions {
  readonly inputs?: readonly string[];
  readonly randoms?: readonly number[];
}

export interface FakeIO extends RuntimeIO {
  readonly output: () => string;
}

/** Entrées/sorties simulées : capture l'affichage, rejoue des entrées et des tirages. */
export function createFakeIO(options: FakeIOOptions = {}): FakeIO {
  const written: string[] = [];
  const inputs = [...(options.inputs ?? [])];
  const randoms = [...(options.randoms ?? [])];
  return {
    write: (text) => {
      written.push(text);
    },
    readLine: () => inputs.shift() ?? null,
    random: () => randoms.shift() ?? 0,
    output: () => written.join(''),
  };
}

export interface RunOutcome {
  readonly output: string;
  readonly errors: readonly Diagnostic[];
}

export interface RunSourceOptions extends FakeIOOptions {
  readonly numberStyle?: NumberStyle;
  readonly maxSteps?: number;
  readonly engine?: Engine;
}

/** Compile et exécute un programme, en ASCII par défaut pour des assertions lisibles. */
export function runSource(source: string, options: RunSourceOptions = {}): RunOutcome {
  const io = createFakeIO(options);
  const result = run(source, {
    io,
    numberStyle: options.numberStyle ?? 'ascii',
    maxSteps: options.maxSteps ?? 100_000,
    engine: options.engine ?? 'compiled',
  });
  return { output: io.output(), errors: result.ok ? [] : result.errors };
}

/** Exécute et renvoie uniquement les lignes affichées (échoue si erreur). */
export function outputLines(source: string, options: RunSourceOptions = {}): string[] {
  const outcome = runSource(source, options);
  if (outcome.errors.length > 0) {
    throw new Error(`Erreur inattendue : ${outcome.errors.map((e) => e.message).join(' | ')}`);
  }
  return outcome.output.split('\n').slice(0, -1);
}

/** Exécute et renvoie le premier message d'erreur (échoue s'il n'y en a pas). */
export function firstError(source: string, options: RunSourceOptions = {}): Diagnostic {
  const [error] = runSource(source, options).errors;
  if (error === undefined) {
    throw new Error('Une erreur était attendue');
  }
  return error;
}
