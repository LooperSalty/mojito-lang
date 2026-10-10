import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { inflateRawSync } from 'node:zlib';
import { build } from 'esbuild';
import {
  diagnosticRange,
  graphemeColumnToOffset,
  hoverAt,
  isEditableScheme,
  NEW_PROGRAM,
  offsetToGraphemeColumn,
  problemsFor,
} from '../editors/vscode/src/core.ts';
import { applyInput } from '../editors/vscode/src/line-editor.ts';
import { createSession, type Session, type SessionEnd } from '../editors/vscode/src/session.ts';
import { compile } from '../src/compiler.ts';
import { compiledOutputPath, isSourceFile } from '../src/files.ts';
import { buildStandalone, isStandaloneOutput } from '../src/standalone.ts';
import { bundle, BUNDLE_OPTIONS, ROOT } from '../scripts/vscode/package-extension.ts';
import { createZip } from '../scripts/vscode/zip.ts';

const CTRL_C = String.fromCharCode(3);
const CTRL_D = String.fromCharCode(4);
const DELETE = String.fromCharCode(127);
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

describe('fichiers .emoji', () => {
  it('reconnaît .emoji et .moj, et nomme la sortie compilée', () => {
    assert.ok(isSourceFile('jeu.emoji'));
    assert.ok(isSourceFile('JEU.MOJ'));
    assert.ok(!isSourceFile('jeu.js'));
    assert.equal(compiledOutputPath('dossier/jeu.emoji'), 'dossier/jeu.js');
    assert.equal(compiledOutputPath('jeu.moj'), 'jeu.js');
    assert.equal(compiledOutputPath('jeu'), 'jeu.js');
  });

  it('reconnaît un fichier produit par Mojito (et seulement lui)', () => {
    const output = buildStandalone('"use strict";\n');
    assert.ok(isStandaloneOutput(output));
    assert.ok(isStandaloneOutput(output.replaceAll('\n', '\r\n')));
    assert.ok(!isStandaloneOutput('console.log("écrit à la main");\n'));
  });
});

describe('extension VS Code — positions et erreurs', () => {
  it('convertit colonnes en graphèmes et positions UTF-16 dans les deux sens', () => {
    const line = '📦 👨‍👩‍👧 ⬅️ 1️⃣';
    assert.equal(graphemeColumnToOffset(line, 1), 0);
    assert.equal(graphemeColumnToOffset(line, 3), 3);
    assert.equal(graphemeColumnToOffset(line, 5), 3 + '👨‍👩‍👧'.length + 1);
    assert.equal(offsetToGraphemeColumn(line, 4), 3);
    assert.equal(offsetToGraphemeColumn(line, 999), 8);
  });

  it('souligne exactement le nom fautif', () => {
    const [problem] = problemsFor('📦 🍎 ⬅️ 1️⃣\n📢 🍌');
    assert.deepEqual(problem?.range, { line: 1, start: 3, end: 5 });
    assert.equal(problem?.kind, 'sémantique');
    assert.deepEqual(problemsFor('📢 💬ok💬'), []);
  });

  it('place les erreurs sans position sur la première ligne', () => {
    const range = diagnosticRange({ kind: 'syntaxe', message: 'x', line: 0, col: 0, width: 0 }, ['📢 1️⃣']);
    assert.deepEqual(range, { line: 0, start: 0, end: '📢 1️⃣'.length });
  });

  it('n’analyse que les fichiers locaux et les brouillons', () => {
    assert.ok(isEditableScheme('file'));
    assert.ok(isEditableScheme('untitled'));
    assert.ok(!isEditableScheme('git'));
  });

  it('propose un programme neuf qui compile', () => {
    assert.ok(compile(NEW_PROGRAM).ok);
  });
});

describe('extension VS Code — survol', () => {
  const source = '🤔 🍎 🚫🟰 1️⃣2️⃣ 📢 💬➡️💬 🔚';

  it('explique un mot-clé avec un exemple', () => {
    const info = hoverAt(source, 0, 0);
    assert.match(info?.markdown ?? '', /\*\*🤔 si\*\* — Conditions/);
    assert.match(info?.markdown ?? '', /```mojito/);
  });

  it('reconnaît 🚫🟰 en entier, les nombres, les noms et les textes', () => {
    const at = (text: string): string => hoverAt(source, 0, source.indexOf(text))?.markdown ?? '';
    assert.match(at('🚫🟰'), /différent de/);
    assert.match(at('1️⃣2️⃣'), /nombre 12/);
    assert.match(at('🍎'), /nom choisi par toi/);
    assert.match(at('➡️'), /texte/);
  });

  it('ne dit rien sur un espace ou un code illisible', () => {
    assert.equal(hoverAt(source, 0, 2), null);
    assert.equal(hoverAt('abc', 0, 0), null);
  });
});

describe('extension VS Code — saisie au clavier', () => {
  it('fait l’écho des emojis et valide la ligne avec Entrée', () => {
    const result = applyInput('', '🍎🍌\r');
    assert.equal(result.echo, '🍎🍌\r\n');
    assert.deepEqual(result.events, [{ kind: 'line', text: '🍎🍌' }]);
    assert.equal(result.text, '');
  });

  it('efface un emoji entier (deux colonnes) avec Retour arrière', () => {
    const result = applyInput('a👨‍👩‍👧', DELETE);
    assert.equal(result.text, 'a');
    assert.equal(result.echo, '\b\b  \b\b');
    assert.equal(applyInput('', DELETE).echo, '');
  });

  it('gère un collage de plusieurs lignes, Ctrl+C, Ctrl+D et ignore les flèches', () => {
    assert.deepEqual(applyInput('', '1\n2\r\n').events, [{ kind: 'line', text: '1' }, { kind: 'line', text: '2' }]);
    assert.deepEqual(applyInput('x', CTRL_C).events, [{ kind: 'interrupt' }]);
    assert.deepEqual(applyInput('', CTRL_D).events, [{ kind: 'eof' }]);
    assert.deepEqual(applyInput('x', CTRL_D).events, []);
    const arrows = applyInput('ab', `${String.fromCharCode(27)}[D${String.fromCharCode(27)}[A`);
    assert.deepEqual(arrows, { text: 'ab', echo: '', events: [] });
  });
});

describe('extension VS Code — exécution dans le terminal (E2E avec le worker compilé)', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'mojito-vscode-'));
  before(async () => {
    await bundle(outDir);
  });
  after(() => rmSync(outDir, { recursive: true, force: true }));

  function runSession(source: string, interact?: (session: Session) => void): Promise<{ output: string; end: SessionEnd }> {
    return new Promise((resolve) => {
      const chunks: string[] = [];
      const session = createSession({
        workerPath: join(outDir, 'program-worker.js'),
        source,
        fileName: 'test.emoji',
        numberStyle: 'ascii',
        write: (text) => chunks.push(text),
        onEnd: (end) => resolve({ output: chunks.join('').replace(ANSI, ''), end }),
      });
      session.open();
      interact?.(session);
    });
  }

  it('exécute un programme et affiche sa sortie', async () => {
    const { output, end } = await runSession('📢 💬👋 🌍💬\n📢 4️⃣ ✖️ 🔟');
    assert.equal(end.kind, 'finished');
    assert.match(output, /▶ test\.emoji/);
    assert.match(output, /👋 🌍\r\n40\r\n✅ Programme terminé\./);
  });

  it('transmet les lignes tapées à 🎤, même tapées en avance', async () => {
    const { output } = await runSession('📢 🎤 🔸 🎤', (session) => session.handleInput('🍎\r🍌\r'));
    assert.match(output, /🍎 🍌\r\n/);
  });

  it('termine les entrées avec Ctrl+D (🎤 renvoie 🕳️)', async () => {
    const { output } = await runSession('📢 🎤', (session) => session.handleInput(CTRL_D));
    assert.match(output, /🕳️/);
  });

  it('arrête une boucle infinie avec Ctrl+C', async () => {
    const { output, end } = await runSession('🔁 ✅ 🔚', (session) => session.handleInput(CTRL_C));
    assert.equal(end.kind, 'stopped');
    assert.match(output, /\^C\r\n⏹️ Programme arrêté\./);
  });

  it('affiche les erreurs d’exécution et de compilation', async () => {
    const runtime = await runSession('📢 1️⃣ ➗ 0️⃣');
    assert.equal(runtime.end.kind, 'finished');
    assert.match(runtime.output, /Erreur d'exécution — test\.emoji:1:5/);
    const compileError = await runSession('📢 🍌');
    assert.equal(compileError.end.kind, 'not-compiled');
    assert.match(compileError.output, /🍌 n'existe pas ici/);
  });

  it('l’extension n’embarque pas l’API vscode', () => {
    assert.match(readFileSync(join(outDir, 'extension.js'), 'utf8'), /require\("vscode"\)/);
  });
});

describe('compilation autonome depuis un bundle', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'mojito-standalone-'));
  after(() => rmSync(outDir, { recursive: true, force: true }));

  it('le runtime recopié par toString() reste autonome une fois bundlé', async () => {
    const bundled = join(outDir, 'standalone.cjs');
    await build({ ...BUNDLE_OPTIONS, entryPoints: [join(ROOT, 'src', 'standalone.ts')], outfile: bundled });
    const { buildStandalone: bundledBuild } = createRequire(import.meta.url)(bundled) as typeof import('../src/standalone.ts');
    const compiled = compile('🔂 🐝 📥 1️⃣ ➡️ 3️⃣ 📢 🐝 ✖️ 🐝 🔚');
    assert.ok(compiled.ok);
    const program = join(outDir, 'carres.js');
    writeFileSync(program, bundledBuild(compiled.js, 'ascii'), 'utf8');
    const result = spawnSync(process.execPath, [program], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.replace(/\r\n/g, '\n'), '1\n4\n9\n');
  });
});

describe('paquet .vsix', () => {
  it('produit une archive zip lisible', () => {
    const data = Buffer.from('🍹 Mojito '.repeat(50), 'utf8');
    const zip = createZip([{ path: 'extension/package.json', data }]);
    assert.equal(zip.readUInt32LE(0), 0x04034b50);
    const nameLength = zip.readUInt16LE(26);
    const compressedSize = zip.readUInt32LE(18);
    assert.equal(zip.subarray(30, 30 + nameLength).toString('utf8'), 'extension/package.json');
    const body = zip.subarray(30 + nameLength, 30 + nameLength + compressedSize);
    assert.deepEqual(inflateRawSync(body), data);
    assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
  });
});
