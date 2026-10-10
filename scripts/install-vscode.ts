import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { EXTENSION_DIR, readManifest } from './vscode/package-extension.ts';

/** Installe (ou met à jour) l'extension Mojito dans VS Code via la commande `code`. */

const SAFE_NAME = /^[\w.-]+$/;
/** Caractères interprétés par cmd.exe ou sh même entre guillemets. */
const SHELL_SPECIAL = /[%$"!`^&|<>]/;

function install(vsix: string): number | null {
  if (process.platform !== 'win32') {
    return spawnSync('code', ['--install-extension', vsix, '--force'], { stdio: 'inherit' }).status;
  }
  // Sous Windows, `code` est un script .cmd : il faut passer par le shell.
  if (SHELL_SPECIAL.test(vsix)) {
    throw new Error(`chemin refusé (caractères spéciaux) : ${vsix}`);
  }
  return spawnSync(`code --install-extension "${vsix}" --force`, { shell: true, stdio: 'inherit' }).status;
}

const manifest = readManifest();
if (!SAFE_NAME.test(manifest.name) || !SAFE_NAME.test(manifest.version)) {
  throw new Error('Nom ou version invalide dans editors/vscode/package.json');
}
const vsix = join(EXTENSION_DIR, `${manifest.name}-${manifest.version}.vsix`);

if (!existsSync(vsix)) {
  process.stderr.write('😕 Paquet absent : lance d’abord « npm run vscode:build ».\n');
  process.exitCode = 1;
} else if (install(vsix) === 0) {
  process.stdout.write('🍹 Extension Mojito installée. Recharge VS Code : Ctrl+Maj+P › « Developer: Reload Window ».\n');
} else {
  process.stderr.write(`😕 « code --install-extension » a échoué. Installe le paquet à la main : Extensions › … › Installer depuis un VSIX › ${vsix}\n`);
  process.exitCode = 1;
}
