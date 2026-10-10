import { createNodeIO } from './runtime/node-io.ts';
import { createRuntime, type NumberStyle } from './runtime/runtime.ts';

const ERROR_HANDLER = [
  '} catch (error) {',
  '  const diagnostic = $rt.diagnose(error);',
  '  if (diagnostic === null) throw error;',
  "  const where = diagnostic.line > 0 ? ' (ligne ' + diagnostic.line + ', colonne ' + diagnostic.col + ')' : '';",
  "  process.stderr.write(\"💥 Erreur d'exécution\" + where + ' : ' + diagnostic.message + '\\n');",
  '  process.exitCode = 1;',
  '}',
];

/**
 * Emballe le JavaScript compilé dans un fichier autonome exécutable avec
 * `node programme.js` (le runtime est recopié dedans, aucune dépendance).
 */
export const STANDALONE_SIGNATURE = '// 🍹 Programme compilé par Mojito — ne pas modifier à la main.';

/** Vrai si ce contenu a été produit par `buildStandalone` (on peut donc l'écraser sans risque). */
export function isStandaloneOutput(content: string): boolean {
  return content.split(/\r?\n/, 2)[1] === STANDALONE_SIGNATURE;
}

export function buildStandalone(js: string, numberStyle: NumberStyle = 'emoji'): string {
  const options = JSON.stringify({ numberStyle, maxSteps: 0 });
  const body = js.trimEnd().split('\n').map((line) => `    ${line}`);
  return [
    '#!/usr/bin/env node',
    STANDALONE_SIGNATURE,
    '"use strict";',
    `const createRuntime = ${createRuntime.toString()};`,
    `const createNodeIO = ${createNodeIO.toString()};`,
    `const $rt = createRuntime(createNodeIO(), ${options});`,
    'try {',
    '  (function ($rt) {',
    ...body,
    '  })($rt);',
    ...ERROR_HANDLER,
    '',
  ].join('\n');
}
