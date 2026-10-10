import { analyze } from './analyzer/analyzer.ts';
import { generate } from './codegen/codegen.ts';
import { MojitoError, type Diagnostic } from './errors.ts';
import type { NamedNode, Program } from './parser/ast.ts';
import { parse } from './parser/parser.ts';

export interface CompileSuccess {
  readonly ok: true;
  readonly js: string;
  readonly program: Program;
  /** Résolution des noms par l'analyseur (utilisée aussi par l'interpréteur). */
  readonly names: ReadonlyMap<NamedNode, string>;
}

export interface CompileFailure {
  readonly ok: false;
  readonly errors: readonly Diagnostic[];
}

export type CompileResult = CompileSuccess | CompileFailure;

/**
 * Pipeline complet : source → jetons → AST → analyse sémantique → JavaScript.
 * Ne lève jamais d'exception pour une erreur dans le programme Mojito.
 */
export function compile(source: string): CompileResult {
  try {
    const program = parse(source);
    const analysis = analyze(program);
    if (analysis.errors.length > 0) {
      return { ok: false, errors: analysis.errors };
    }
    return { ok: true, js: generate(program, analysis.names), program, names: analysis.names };
  } catch (error) {
    if (error instanceof MojitoError) {
      return { ok: false, errors: [error] };
    }
    if (error instanceof RangeError) {
      const message = 'Programme trop imbriqué pour être compilé : découpe-le en fonctions plus petites.';
      return { ok: false, errors: [new MojitoError('syntaxe', message, { line: 0, col: 0 }, 0)] };
    }
    throw error;
  }
}
