import { build } from 'esbuild';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSourceFile } from '../src/files.ts';

/**
 * Construit le playground en UNE page HTML autonome :
 *  - dist/index.html    : document complet, à ouvrir directement dans un navigateur
 *  - dist/artifact.html : même contenu sans <html>/<head>/<body> (pour publication)
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PLAYGROUND = join(ROOT, 'playground');
const DIST = join(PLAYGROUND, 'dist');
const MARKER = '/*__MOJITO_BUNDLE__*/';

function readExamples(): Record<string, string> {
  const directory = join(ROOT, 'examples');
  const files = readdirSync(directory).filter(isSourceFile);
  return Object.fromEntries(files.map((name) => [name, readFileSync(join(directory, name), 'utf8')]));
}

async function bundle(): Promise<string> {
  const result = await build({
    entryPoints: [join(PLAYGROUND, 'src', 'main.ts')],
    bundle: true,
    format: 'iife',
    minify: true,
    target: ['es2022'],
    charset: 'utf8',
    write: false,
    define: { __EXAMPLES__: JSON.stringify(readExamples()) },
  });
  const [output] = result.outputFiles;
  if (output === undefined) {
    throw new Error("esbuild n'a produit aucun fichier");
  }
  // Empêche une séquence « </script » dans le code de fermer la balise.
  return output.text.replaceAll('</script', '<\\/script');
}

async function main(): Promise<void> {
  const template = readFileSync(join(PLAYGROUND, 'template.html'), 'utf8');
  if (!template.includes(MARKER)) {
    throw new Error(`Marqueur ${MARKER} absent du gabarit`);
  }
  const bundleCode = await bundle();
  const page = template.replace(MARKER, () => bundleCode);
  const documentPage = [
    '<!doctype html>',
    '<html lang="fr">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    '</head>',
    '<body>',
    page,
    '</body>',
    '</html>',
  ].join('\n');
  mkdirSync(DIST, { recursive: true });
  writeFileSync(join(DIST, 'artifact.html'), page, 'utf8');
  writeFileSync(join(DIST, 'index.html'), documentPage, 'utf8');
  const kilobytes = Math.round(Buffer.byteLength(documentPage) / 1024);
  process.stdout.write(`🍹 Playground construit : playground/dist/index.html (${kilobytes} Ko)\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`💥 Échec du build du playground : ${String(error)}\n`);
  process.exitCode = 1;
});
