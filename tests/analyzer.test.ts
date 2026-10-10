import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyze } from '../src/analyzer/analyzer.ts';
import { parse } from '../src/parser/parser.ts';

const messages = (source: string): string[] => analyze(parse(source)).errors.map((error) => error.message);

function onlyError(source: string): string {
  const errors = messages(source);
  assert.equal(errors.length, 1, `une seule erreur attendue, reçu : ${errors.join(' | ')}`);
  return errors[0] ?? '';
}

describe('analyseur sémantique', () => {
  it('accepte un programme correct', () => {
    assert.deepEqual(messages('📦 🍎 ⬅️ 1️⃣\n🍎 ⬅️ 🍎 ➕ 1️⃣\n📢 🍎'), []);
  });

  it('signale une variable jamais déclarée', () => {
    assert.match(onlyError('📢 🍎'), /🍎 n'existe pas/);
  });

  it('signale une redéclaration dans le même bloc', () => {
    assert.match(onlyError('📦 🍎 ⬅️ 1️⃣\n📦 🍎 ⬅️ 2️⃣'), /déjà déclaré.*ligne 1/);
  });

  it('autorise le masquage dans un bloc imbriqué', () => {
    assert.deepEqual(messages('📦 🍎 ⬅️ 1️⃣\n🤔 ✅\n📦 🍎 ⬅️ 2️⃣\n🔚'), []);
  });

  it('interdit de modifier une constante ou une fonction', () => {
    assert.match(onlyError('🔒 🍎 ⬅️ 1️⃣\n🍎 ⬅️ 2️⃣'), /constante/);
    assert.match(onlyError('🧩 🐇 👉👈 🔚\n🐇 ⬅️ 2️⃣'), /fonction/);
  });

  it('remonte les fonctions pour la récursion croisée', () => {
    const source = [
      '🧩 🅰️ 👉 🐟 👈 ↩️ 🅱️👉🐟👈 🔚',
      '🧩 🅱️ 👉 🐟 👈 ↩️ 🅰️👉🐟👈 🔚',
    ].join('\n');
    assert.deepEqual(messages(source), []);
  });

  it('vérifie le nombre d’arguments des fonctions déclarées', () => {
    assert.match(onlyError('🧩 🐇 👉 🥚 👈 🔚\n🐇👉👈'), /attend 1 argument/);
  });

  it('refuse ↩️ hors fonction et 💥 / ⏭️ hors boucle', () => {
    assert.match(onlyError('↩️ 1️⃣'), /fonction/);
    assert.match(onlyError('💥'), /boucle/);
    assert.match(onlyError('⏭️'), /boucle/);
  });

  it('ne laisse pas 💥 traverser une fonction', () => {
    assert.match(onlyError('🔁 ✅\n🧩 🐇 👉👈 💥 🔚\n🔚'), /boucle/);
  });

  it('déclare la variable de boucle et les paramètres', () => {
    assert.deepEqual(messages('🔂 🐝 📥 1️⃣ ➡️ 3️⃣ 📢 🐝 🔚'), []);
    assert.deepEqual(messages('📦 🪄 ⬅️ 🧩 👉 🐟 👈 ↩️ 🐟 🔚'), []);
  });

  it('refuse deux paramètres de même nom', () => {
    assert.match(onlyError('🧩 🐇 👉 🐟 🔸 🐟 👈 🔚'), /déjà déclaré/);
  });

  it('ne voit pas une variable avant sa déclaration', () => {
    assert.match(onlyError('📢 🍎\n📦 🍎 ⬅️ 1️⃣'), /n'existe pas/);
  });

  it('résout 📦 🍎 ⬅️ 🍎 vers la variable extérieure', () => {
    assert.deepEqual(messages('📦 🍎 ⬅️ 1️⃣\n🤔 ✅\n📦 🍎 ⬅️ 🍎 ➕ 1️⃣\n🔚'), []);
  });

  it('attribue des noms JavaScript uniques aux variables masquées', () => {
    const { names } = analyze(parse('📦 🍎 ⬅️ 1️⃣\n🤔 ✅\n📦 🍎 ⬅️ 2️⃣\n🔚'));
    assert.deepEqual([...new Set(names.values())].sort(), ['_1f34e', '_1f34e$1']);
  });

  it('rapporte toutes les erreurs, pas seulement la première', () => {
    assert.equal(messages('📢 🍎\n📢 🍌\n💥').length, 3);
  });
});
