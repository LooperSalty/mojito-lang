import { resolve } from 'node:path';
import { compile } from '../compiler.ts';
import { formatDiagnostic, MojitoError, type Diagnostic } from '../errors.ts';
import { executeCompiled, executeInterpreted } from '../execute.ts';
import { compiledOutputPath } from '../files.ts';
import { tokenize } from '../lexer/lexer.ts';
import { parse } from '../parser/parser.ts';
import type { RuntimeIO } from '../runtime/runtime.ts';
import { buildStandalone } from '../standalone.ts';
import { parseCliArgs, type CliOptions } from './args.ts';
import { helpText, VERSION } from './help.ts';

export interface CliEnvironment {
  readonly readFile: (path: string) => string;
  readonly writeFile: (path: string, content: string) => void;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  readonly io: RuntimeIO;
}

export const EXIT_OK = 0;
export const EXIT_FAILURE = 1;
export const EXIT_USAGE = 2;

interface Job {
  readonly options: CliOptions;
  readonly file: string;
  readonly source: string;
  readonly env: CliEnvironment;
}

/** Point d'entrée de la ligne de commande. Renvoie le code de sortie. */
export function main(argv: readonly string[], env: CliEnvironment): number {
  const parsed = parseCliArgs(argv);
  if (!parsed.ok) {
    env.stderr(`😕 ${parsed.message}\n`);
    return EXIT_USAGE;
  }
  const { options } = parsed;
  if (options.command === 'help') {
    env.stdout(helpText());
    return EXIT_OK;
  }
  if (options.command === 'version') {
    env.stdout(`🍹 Mojito ${VERSION}\n`);
    return EXIT_OK;
  }
  const file = options.file ?? '';
  const source = readSource(file, env);
  if (source === null) {
    return EXIT_FAILURE;
  }
  return runCommand({ options, file, source, env });
}

function readSource(file: string, env: CliEnvironment): string | null {
  try {
    return env.readFile(file);
  } catch (error) {
    const code = (error as { code?: string }).code;
    const reason = code === 'ENOENT' ? 'fichier introuvable' : (error as Error).message;
    env.stderr(`😕 Impossible de lire « ${file} » : ${reason}\n`);
    return null;
  }
}

function report(job: Job, errors: readonly Diagnostic[]): number {
  const text = errors.map((error) => formatDiagnostic(error, job.source, job.file)).join('\n\n');
  job.env.stderr(`${text}\n`);
  return EXIT_FAILURE;
}

/** Exécute une étape du compilateur en convertissant ses erreurs en diagnostics. */
function attempt(job: Job, step: () => string): number {
  try {
    job.env.stdout(step());
    return EXIT_OK;
  } catch (error) {
    if (error instanceof MojitoError) {
      return report(job, [error]);
    }
    throw error;
  }
}

function runCommand(job: Job): number {
  switch (job.options.command) {
    case 'tokens':
      return attempt(job, () => formatTokens(job.source));
    case 'ast':
      return attempt(job, () => `${JSON.stringify(parse(job.source), null, 2)}\n`);
    default:
      return compileAndAct(job);
  }
}

function formatTokens(source: string): string {
  return tokenize(source)
    .map((token) => {
      const where = `${token.line}:${token.col}`.padEnd(7);
      const value = token.value === null ? '' : `  → ${JSON.stringify(token.value)}`;
      return `${where} ${token.type.padEnd(9)} ${token.lexeme}${value}`;
    })
    .join('\n')
    .concat('\n');
}

function compileAndAct(job: Job): number {
  const compiled = compile(job.source);
  if (!compiled.ok) {
    return report(job, compiled.errors);
  }
  const { options, env } = job;
  switch (options.command) {
    case 'check':
      env.stdout(`✅ Aucune erreur dans ${job.file} 🍹\n`);
      return EXIT_OK;
    case 'js':
      env.stdout(compiled.js);
      return EXIT_OK;
    case 'build':
      return build(job, compiled.js);
    default: {
      const settings = { io: env.io, numberStyle: options.numberStyle, maxSteps: options.maxSteps };
      const result = options.engine === 'interpreter'
        ? executeInterpreted(compiled, settings)
        : executeCompiled(compiled.js, settings);
      return result.ok ? EXIT_OK : report(job, result.errors);
    }
  }
}

/** Compare deux chemins après résolution (sans tenir compte de la casse sous Windows). */
function samePath(a: string, b: string): boolean {
  const normalize = (path: string): string => {
    const absolute = resolve(path);
    return process.platform === 'win32' ? absolute.toLowerCase() : absolute;
  };
  return normalize(a) === normalize(b);
}

function build(job: Job, js: string): number {
  const output = job.options.output ?? compiledOutputPath(job.file);
  if (samePath(output, job.file)) {
    job.env.stderr('😕 Le fichier de sortie ne peut pas remplacer le fichier source.\n');
    return EXIT_USAGE;
  }
  job.env.writeFile(output, buildStandalone(js, job.options.numberStyle));
  job.env.stdout(`📦 ${job.file} ➡️ ${output} (lance-le avec : node ${output})\n`);
  return EXIT_OK;
}
