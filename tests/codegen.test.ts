import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { demangle, mangle } from '../src/codegen/identifiers.ts';
import { compile } from '../src/compiler.ts';

function js(source: string): string {
  const result = compile(source);
  assert.ok(result.ok, 'la compilation devait réussir');
  return result.js;
}

describe('noms JavaScript', () => {
  it('encode un emoji en identifiant valide et le décode', () => {
    assert.equal(mangle('🍎'), '_1f34e');
    assert.equal(demangle('_1f34e'), '🍎');
    assert.equal(demangle('_1f34e$2'), '🍎');
    assert.equal(demangle('pomme'), null);
  });

  it('produit des identifiants acceptés par JavaScript', () => {
    for (const name of ['🍎', '👨‍👩‍👧', '🐱1⃣', '🇫🇷']) {
      assert.doesNotThrow(() => new Function(`let ${mangle(name)} = 1;`));
    }
  });
});

describe('générateur de code', () => {
  it('commence en mode strict', () => {
    assert.ok(js('📢 1️⃣').startsWith('"use strict";'));
  });

  it('traduit les déclarations en let / const avec le nom emoji en commentaire', () => {
    assert.match(js('📦 🍎 ⬅️ 1️⃣'), /let _1f34e = 1; \/\/ 🍎/);
    assert.match(js('🔒 🍎 ⬅️ 1️⃣'), /const _1f34e = 1;/);
  });

  it('protège les textes avec JSON.stringify (pas d’injection)', () => {
    const output = js('📢 💬"); process.exit(1); ("💬');
    assert.match(output, /\$rt\.print\(\["\\"\); process\.exit\(1\); \(\\""\]\);/);
  });

  it('passe par le runtime pour les opérations vérifiées', () => {
    const output = js('📦 🍎 ⬅️ 1️⃣ ➕ 2️⃣ ✖️ 3️⃣');
    assert.match(output, /\$rt\.add\(1, \$rt\.mul\(2, 3, "1:13"\), "1:9"\)/);
  });

  it('génère des conditions et boucles avec vérification booléenne et compteur d’étapes', () => {
    const output = js('🔁 ✅ 💥 🔚');
    assert.match(output, /while \(\$rt\.bool\(true, "1:3"\)\) \{\n {2}\$rt\.tick\("1:1"\);\n {2}break;\n\}/);
  });

  it('génère des fonctions anonymes indentées', () => {
    const output = js('📦 🪄 ⬅️ 🧩 👉 🐟 👈\n↩️ 🐟\n🔚');
    assert.match(output, /let _1fa84 = \(function \(_1f41f\) \{\n {2}return _1f41f;\n\}\); \/\/ 🪄/);
  });

  it('court-circuite 🤝 et 🤷', () => {
    assert.match(js('📢 ✅ 🤷 ❌'), /\(\$rt\.bool\(true, "1:3"\) \|\| \$rt\.bool\(false, "1:7"\)\)/);
  });
});
