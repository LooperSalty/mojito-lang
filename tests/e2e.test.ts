import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLI = join(ROOT, 'bin', 'mojito.ts');
const workDir = mkdtempSync(join(tmpdir(), 'mojito-e2e-'));

after(() => rmSync(workDir, { recursive: true, force: true }));

function node(args: readonly string[], input = ''): { stdout: string; stderr: string; status: number | null } {
  // --no-warnings : Node 22 signale le « type stripping » comme expérimental sur stderr.
  const result = spawnSync(process.execPath, ['--no-warnings', ...args], { cwd: ROOT, input, encoding: 'utf8' });
  return { stdout: result.stdout.replace(/\r\n/g, '\n'), stderr: result.stderr, status: result.status };
}

function mojito(args: readonly string[], input = ''): { stdout: string; stderr: string; status: number | null } {
  return node([CLI, ...args], input);
}

const EXPECTED: Readonly<Record<string, string>> = {
  'bonjour.emoji': '👋 🌍\n🍎 ➕ 🍌 🟰 42\n',
  'fizzbuzz.emoji': '1\n2\n🍾\n4\n🫧\n🍾\n7\n8\n🍾\n🫧\n11\n🍾\n13\n14\n🍾🫧\n',
  'compteur.emoji': '🐢 1 2 3\n🐇 10 20 30\n',
  'pyramide.emoji': '⬛⬛⬛⬛🟨\n⬛⬛⬛🟨🟨🟨\n⬛⬛🟨🟨🟨🟨🟨\n⬛🟨🟨🟨🟨🟨🟨🟨\n🟨🟨🟨🟨🟨🟨🟨🟨🟨\n🐪🌴🐪🌴🐪🌴🐪🌴🐪\n',
  'tri.emoji': '🎰 🌜 42 🔸 7 🔸 19 🔸 3 🔸 100 🔸 0 🔸 25 🌛\n✨ 🌜 0 🔸 3 🔸 7 🔸 19 🔸 25 🔸 42 🔸 100 🌛\n',
  'carres.emoji': '🟦 🌜 1 🔸 4 🔸 9 🔸 16 🔸 25 🔸 36 🔸 49 🔸 64 🔸 81 🔸 100 🌛\n⚖️ 🌜 2 🔸 4 🔸 6 🔸 8 🔸 10 🌛\n🌟🌟🌟🌟🌟\n',
};

describe('E2E — exemples via la CLI', () => {
  for (const [file, expected] of Object.entries(EXPECTED)) {
    it(`exécute examples/${file}`, () => {
      const result = mojito(['run', join('examples', file), '--ascii']);
      assert.equal(result.stderr, '');
      assert.equal(result.status, 0);
      assert.equal(result.stdout, expected);
    });
  }

  it('calcule Fibonacci, la factorielle et les nombres premiers', () => {
    assert.match(mojito(['run', 'examples/fibonacci.emoji', '--ascii']).stdout, /10 ➡️ 55\n$/);
    assert.match(mojito(['run', 'examples/factorielle.emoji', '--ascii']).stdout, /10 ❗ 🟰 3628800\n$/);
    assert.match(mojito(['run', 'examples/premiers.emoji', '--ascii']).stdout, /97 🌛\n🧮 25\n$/);
  });

  it('joue au jeu du nombre secret avec l’entrée standard', () => {
    const result = mojito(['run', 'examples/devine.emoji', '--ascii'], '200\n-5\nabc\n');
    assert.equal(result.status, 0);
    assert.match(result.stdout, /⬇️\n⬆️\n🤷 1️⃣2️⃣3️⃣ ❓\n👋 🎯 🟰 \d+\n$/);
  });

  it('renvoie un code d’erreur et un message en cas d’erreur', () => {
    const result = mojito(['run', join(workDir, 'absent.emoji')]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /introuvable/);
  });
});

describe('E2E — compilation autonome', () => {
  it('produit un fichier JavaScript exécutable sans Mojito', () => {
    const output = join(workDir, 'fizzbuzz.js');
    const build = mojito(['build', 'examples/fizzbuzz.emoji', '-o', output, '--ascii']);
    assert.equal(build.status, 0, build.stderr);
    const result = node([output]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, EXPECTED['fizzbuzz.emoji']);
  });

  it('embarque le runtime : entrées, emojis et erreurs fonctionnent', () => {
    const output = join(workDir, 'devine.js');
    assert.equal(mojito(['build', 'examples/devine.emoji', '-o', output]).status, 0);
    const result = node([output], '500\n');
    assert.match(result.stdout, /^🤫 1️⃣ ➡️ 💯 ❓\n⬇️\n👋 🎯 🟰/);
  });

  it('signale les erreurs d’exécution dans le programme compilé', () => {
    const output = join(workDir, 'erreur.js');
    const source = join(workDir, 'erreur.emoji');
    writeFileSync(source, '📢 1️⃣ ➗ 0️⃣', 'utf8');
    assert.equal(mojito(['build', source, '-o', output]).status, 0);
    const result = node([output]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Division par zéro/);
  });
});
