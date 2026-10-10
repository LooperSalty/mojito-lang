import { join } from 'node:path';
import { bundle, EXTENSION_DIR, writeVsix } from './vscode/package-extension.ts';
import { writeSnippets } from './vscode/snippets.ts';

/** Construit l'extension VS Code : snippets, bundles JavaScript et paquet .vsix. */
try {
  const count = writeSnippets();
  process.stdout.write(`🧩 ${count} snippets écrits dans editors/vscode/snippets/mojito.json\n`);
  await bundle(join(EXTENSION_DIR, 'dist'));
  const vsix = writeVsix(EXTENSION_DIR);
  process.stdout.write(`📦 Extension empaquetée : ${vsix}\n`);
} catch (error) {
  process.stderr.write(`💥 Échec du build de l'extension : ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
