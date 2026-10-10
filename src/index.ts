/** API publique du compilateur Mojito 🍹 */
export { compile, type CompileResult, type CompileSuccess, type CompileFailure } from './compiler.ts';
export {
  run,
  executeCompiled,
  executeInterpreted,
  type Engine,
  type ExecuteOptions,
  type ExecuteResult,
} from './execute.ts';
export { interpret } from './interpreter/interpreter.ts';
export { buildStandalone } from './standalone.ts';
export { tokenize } from './lexer/lexer.ts';
export { KEYWORD_SPECS, type Token, type TokenType, type KeywordSpec } from './lexer/tokens.ts';
export { parse } from './parser/parser.ts';
export { analyze } from './analyzer/analyzer.ts';
export { generate } from './codegen/codegen.ts';
export { formatDiagnostic, MojitoError, type Diagnostic } from './errors.ts';
export { createRuntime, type RuntimeIO, type NumberStyle } from './runtime/runtime.ts';
export type * from './parser/ast.ts';
