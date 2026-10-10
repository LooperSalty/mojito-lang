import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runSource, type RunSourceOptions } from './helpers.ts';

const EXAMPLES = fileURLToPath(new URL('../examples/', import.meta.url));

/** Exécute avec les deux moteurs et vérifie qu'ils se comportent à l'identique. */
function assertSameBehaviour(source: string, options: RunSourceOptions = {}): string {
  const compiled = runSource(source, { ...options, engine: 'compiled' });
  const interpreted = runSource(source, { ...options, engine: 'interpreter' });
  assert.equal(interpreted.output, compiled.output);
  assert.deepEqual(
    interpreted.errors.map((error) => error.message),
    compiled.errors.map((error) => error.message),
  );
  return interpreted.output;
}

describe('interpréteur ≡ compilateur — exemples', () => {
  for (const file of readdirSync(EXAMPLES).filter((name) => name.endsWith('.emoji'))) {
    it(`même sortie pour ${file}`, () => {
      const source = readFileSync(join(EXAMPLES, file), 'utf8');
      const output = assertSameBehaviour(source, { inputs: ['50', '-3', 'abc', '42'], randoms: [0.41] });
      assert.notEqual(output, '');
    });
  }
});

describe('interpréteur ≡ compilateur — sémantique fine', () => {
  const programs: Readonly<Record<string, string>> = {
    'portée des fermetures masquées': [
      '📦 🍎 ⬅️ 1️⃣',
      '🤔 ✅',
      '  🧩 🐇 👉👈 ↩️ 🍎 🔚',
      '  📦 🍎 ⬅️ 2️⃣',
      '  📢 🐇👉👈 🔸 🍎',
      '🔚',
    ].join('\n'),
    'variable lue avant son initialisation': '📢 🐇👉👈\n📦 🍎 ⬅️ 1️⃣\n🧩 🐇 👉👈 ↩️ 🍎 🔚',
    'variable modifiée avant son initialisation': '🐇👉👈\n📦 🍎 ⬅️ 1️⃣\n🧩 🐇 👉👈 🍎 ⬅️ 2️⃣ 🔚',
    'fermetures créées dans une boucle': [
      '📦 📋 ⬅️ 🌜🌛',
      '🔂 🐝 📥 1️⃣ ➡️ 3️⃣',
      '  📋 ⬅️ 📋 ➕ 🌜 🧩 👉👈 ↩️ 🐝 ✖️ 🔟 🔚 🌛',
      '🔚',
      '🔂 🪄 📥 📋 📢 🪄👉👈 🔚',
    ].join('\n'),
    'break, continue et return imbriqués': [
      '🧩 🔍 👉 📋 🔸 🎯 👈',
      '  🔂 🐝 📥 📋',
      '    🤔 🐝 🟰 🎯 ↩️ ✅ 🔚',
      '    🔁 ✅ 💥 🔚',
      '    ⏭️',
      '  🔚',
      '  ↩️ ❌',
      '🔚',
      '📢 🔍👉🌜1️⃣ 🔸 2️⃣🌛 🔸 2️⃣👈 🔸 🔍👉🌜🌛 🔸 1️⃣👈',
    ].join('\n'),
    'court-circuit': '📢 ❌ 🤝 👉 1️⃣ ➗ 0️⃣ 🟰 1️⃣ 👈 🔸 ✅ 🤷 💬x💬 🔸 ❌ 🤷 ✅ 🔸 ✅ 🤝 ❌',
    'erreur de type dans 🤝': '📢 ✅ 🤝 1️⃣',
    'ordre d’évaluation des cases': '📦 📋 ⬅️ 🌜 0️⃣ 🔸 0️⃣ 🌛\n📦 🐝 ⬅️ 0️⃣\n📋🌜🐝🌛 ⬅️ 🧩 👉👈 🐝 ⬅️ 1️⃣ ↩️ 9️⃣ 🔚👉👈\n📢 📋',
    'tous les opérateurs': '📢 7️⃣ ➖ 2️⃣ 🔸 7️⃣ ➗ 2️⃣ 🔸 7️⃣ 🍕 2️⃣ 🔸 1️⃣ 🚫🟰 2️⃣ 🔸 1️⃣ ⏫ 2️⃣ 🔸 1️⃣ ⏬ 2️⃣ 🔸 1️⃣ 🔼 2️⃣ 🔸 🚫 ✅ 🔸 🔤 1️⃣ 🔸 🔢 💬5💬 🔸 📏 💬ab💬 🔸 🎲 3️⃣ 🔸 🌜1️⃣🌛🌜0️⃣🌛',
    'appel d’une non-fonction': '📦 🍎 ⬅️ 1️⃣\n🍎👉👈',
    'mauvais nombre d’arguments': '📦 🪄 ⬅️ 🧩 👉 🐟 👈 🔚\n🪄👉👈',
    'récursion infinie': '🧩 ♾️ 👉👈 ↩️ ♾️👉👈 🔚\n♾️👉👈',
    'boucle infinie': '🔁 ✅ 🔚',
    'entrées': '📢 🎤 🔸 🎤',
  };

  for (const [name, source] of Object.entries(programs)) {
    it(name, () => {
      assertSameBehaviour(source, { inputs: ['🍎'], randoms: [0.5], maxSteps: 1000 });
    });
  }

  it('la fermeture voit la variable du bloc déclarée après elle (portée lexicale à la JavaScript)', () => {
    const output = runSource(programs['portée des fermetures masquées'] ?? '', { engine: 'interpreter' }).output;
    assert.equal(output, '2 2\n');
  });

  it('la variable lue trop tôt est signalée là où elle est lue', () => {
    const [error] = runSource(programs['variable lue avant son initialisation'] ?? '', { engine: 'interpreter' }).errors;
    assert.equal(error?.line, 3);
  });
});
