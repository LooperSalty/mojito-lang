import { compile, type CompileSuccess } from './compiler.ts';
import type { Diagnostic } from './errors.ts';
import { interpret } from './interpreter/interpreter.ts';
import { createRuntime, type NumberStyle, type Runtime, type RuntimeIO } from './runtime/runtime.ts';

/** `compiled` : JavaScript généré ; `interpreter` : parcours direct de l'AST. */
export type Engine = 'compiled' | 'interpreter';

export interface ExecuteOptions {
  readonly io: RuntimeIO;
  readonly numberStyle?: NumberStyle;
  /** Nombre maximal de tours de boucle (0 ou absent = illimité). */
  readonly maxSteps?: number;
  readonly engine?: Engine;
}

export type ExecuteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: readonly Diagnostic[] };

function makeRuntime(options: ExecuteOptions): Runtime {
  return createRuntime(options.io, {
    numberStyle: options.numberStyle ?? 'emoji',
    maxSteps: options.maxSteps ?? 0,
  });
}

/** Lance le programme et traduit les exceptions en diagnostics Mojito. */
function guarded(runtime: Runtime, action: () => void): ExecuteResult {
  try {
    action();
    return { ok: true };
  } catch (error) {
    const diagnostic = runtime.diagnose(error);
    if (diagnostic === null) {
      throw error;
    }
    return { ok: false, errors: [{ kind: 'exécution', width: 1, ...diagnostic }] };
  }
}

/** Exécute du JavaScript produit par le compilateur Mojito. */
export function executeCompiled(js: string, options: ExecuteOptions): ExecuteResult {
  const runtime = makeRuntime(options);
  return guarded(runtime, () => {
    const program = new Function('$rt', js) as (rt: Runtime) => void;
    program(runtime);
  });
}

/** Exécute un programme compilé en parcourant son AST (sans `new Function`). */
export function executeInterpreted(compiled: CompileSuccess, options: ExecuteOptions): ExecuteResult {
  const runtime = makeRuntime(options);
  return guarded(runtime, () => interpret(compiled.program, compiled.names, runtime));
}

/** Compile puis exécute un programme Mojito avec le moteur demandé. */
export function run(source: string, options: ExecuteOptions): ExecuteResult {
  const compiled = compile(source);
  if (!compiled.ok) {
    return compiled;
  }
  return options.engine === 'interpreter'
    ? executeInterpreted(compiled, options)
    : executeCompiled(compiled.js, options);
}
