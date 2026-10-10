import { parseArgs } from 'node:util';
import type { Engine } from '../execute.ts';
import type { NumberStyle } from '../runtime/runtime.ts';

export type Command = 'run' | 'build' | 'js' | 'check' | 'tokens' | 'ast' | 'help' | 'version';

export interface CliOptions {
  readonly command: Command;
  readonly file: string | null;
  readonly output: string | null;
  readonly numberStyle: NumberStyle;
  readonly maxSteps: number;
  readonly engine: Engine;
}

export type ParsedArgs =
  | { readonly ok: true; readonly options: CliOptions }
  | { readonly ok: false; readonly message: string };

const COMMAND_ALIASES: Readonly<Record<string, Command>> = {
  run: 'run',
  lancer: 'run',
  build: 'build',
  compiler: 'build',
  js: 'js',
  check: 'check',
  verifier: 'check',
  tokens: 'tokens',
  ast: 'ast',
  help: 'help',
  aide: 'help',
  version: 'version',
};

const COMMANDS_NEEDING_FILE: ReadonlySet<Command> = new Set<Command>(['run', 'build', 'js', 'check', 'tokens', 'ast']);

function parseMaxSteps(raw: string | undefined): number | null {
  if (raw === undefined) {
    return 0;
  }
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function resolveCommand(name: string | undefined, help: boolean, version: boolean): Command | undefined {
  if (help) return 'help';
  if (version) return 'version';
  if (name === undefined) return 'help';
  return Object.hasOwn(COMMAND_ALIASES, name) ? COMMAND_ALIASES[name] : undefined;
}

/** Interprète la ligne de commande : `mojito <commande> <fichier> [options]`. */
export function parseCliArgs(argv: readonly string[]): ParsedArgs {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      options: {
        output: { type: 'string', short: 'o' },
        ascii: { type: 'boolean' },
        interprete: { type: 'boolean' },
        'max-etapes': { type: 'string' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    });
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
  const { values, positionals } = parsed;
  const [commandName, file, ...extra] = positionals;
  const command = resolveCommand(commandName, values.help === true, values.version === true);

  if (command === undefined) {
    return { ok: false, message: `Commande inconnue : « ${commandName} ». Tape « mojito aide ».` };
  }
  if (COMMANDS_NEEDING_FILE.has(command) && file === undefined) {
    return { ok: false, message: `La commande « ${command} » a besoin d'un fichier .emoji` };
  }
  if (extra.length > 0) {
    return { ok: false, message: `Arguments en trop : ${extra.join(' ')}` };
  }
  const maxSteps = parseMaxSteps(values['max-etapes']);
  if (maxSteps === null) {
    return { ok: false, message: '--max-etapes attend un nombre entier positif.' };
  }
  return {
    ok: true,
    options: {
      command,
      file: file ?? null,
      output: values.output ?? null,
      numberStyle: values.ascii ? 'ascii' : 'emoji',
      maxSteps,
      engine: values.interprete ? 'interpreter' : 'compiled',
    },
  };
}
