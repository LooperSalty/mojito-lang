import { build } from 'esbuild';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createZip, type ZipEntry } from './zip.ts';

/** Construit l'extension VS Code : bundles JavaScript puis paquet .vsix installable. */

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const EXTENSION_DIR = join(ROOT, 'editors', 'vscode');

/** Fichiers de l'extension qui partent dans le paquet (le code source TypeScript reste dehors). */
const PACKAGED = ['package.json', 'README.md', 'language-configuration.json', 'images', 'snippets', 'syntaxes', 'dist'];

interface Manifest {
  readonly name: string;
  readonly displayName: string;
  readonly description: string;
  readonly version: string;
  readonly publisher: string;
  readonly engines: { readonly vscode: string };
}

export function readManifest(): Manifest {
  return JSON.parse(readFileSync(join(EXTENSION_DIR, 'package.json'), 'utf8')) as Manifest;
}

/**
 * Options communes des bundles. Cible node16 (VS Code 1.80) : les champs de
 * classe restent natifs, ce qui garde `createRuntime.toString()` autonome
 * pour la compilation en fichier .js.
 */
export const BUNDLE_OPTIONS = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node16',
  charset: 'utf8',
  logLevel: 'error',
} as const;

/** Deux bundles : l'extension (API vscode exclue) et le thread qui exécute les programmes. */
export async function bundle(outDir: string): Promise<void> {
  const source = (name: string): string => join(EXTENSION_DIR, 'src', name);
  await build({ ...BUNDLE_OPTIONS, entryPoints: [source('extension.ts')], outfile: join(outDir, 'extension.js'), external: ['vscode'] });
  await build({ ...BUNDLE_OPTIONS, entryPoints: [source('program-worker.ts')], outfile: join(outDir, 'program-worker.js') });
}

function escapeXml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function vsixManifest(manifest: Manifest): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="${escapeXml(manifest.name)}" Version="${escapeXml(manifest.version)}" Publisher="${escapeXml(manifest.publisher)}" />
    <DisplayName>${escapeXml(manifest.displayName)}</DisplayName>
    <Description xml:space="preserve">${escapeXml(manifest.description)}</Description>
    <Categories>Programming Languages,Snippets</Categories>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="${escapeXml(manifest.engines.vscode)}" />
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code" />
  </Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
  </Assets>
</PackageManifest>
`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension=".json" ContentType="application/json" />
  <Default Extension=".vsixmanifest" ContentType="text/xml" />
  <Default Extension=".js" ContentType="application/javascript" />
  <Default Extension=".cjs" ContentType="application/javascript" />
  <Default Extension=".md" ContentType="text/markdown" />
  <Default Extension=".svg" ContentType="image/svg+xml" />
</Types>
`;

function listFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) {
    return [path];
  }
  return readdirSync(path).flatMap((name) => listFiles(join(path, name)));
}

/** Écrit le paquet .vsix et renvoie son chemin. */
export function writeVsix(distDir: string): string {
  const manifest = readManifest();
  const files = PACKAGED.flatMap((name) => listFiles(join(EXTENSION_DIR, name))).filter((file) => !file.endsWith('.vsix'));
  const entries: ZipEntry[] = [
    { path: '[Content_Types].xml', data: Buffer.from(CONTENT_TYPES, 'utf8') },
    { path: 'extension.vsixmanifest', data: Buffer.from(vsixManifest(manifest), 'utf8') },
    ...files.map((file) => ({
      path: `extension/${relative(EXTENSION_DIR, file).split(sep).join('/')}`,
      data: readFileSync(file),
    })),
  ];
  mkdirSync(distDir, { recursive: true });
  const output = join(distDir, `${manifest.name}-${manifest.version}.vsix`);
  writeFileSync(output, createZip(entries));
  return output;
}
