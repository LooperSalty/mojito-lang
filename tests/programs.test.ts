import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { compile } from '../src/compiler.ts';
import { firstError, outputLines, runSource } from './helpers.ts';

describe('programmes — valeurs et affichage', () => {
  it('affiche nombres, textes, booléens, rien et listes', () => {
    assert.deepEqual(outputLines('📢 4️⃣2️⃣ 🔸 💬🍹💬 🔸 ✅ 🔸 ❌ 🔸 🕳️ 🔸 🌜 1️⃣ 🔸 💬a💬 🌛 🔸 🌜🌛'), [
      '42 🍹 ✅ ❌ 🕳️ 🌜 1 🔸 💬a💬 🌛 🌜🌛',
    ]);
  });

  it('affiche les nombres en emojis par défaut', () => {
    const { output } = runSource('📢 ➖4️⃣2️⃣ 🔸 3️⃣⏺️5️⃣', { numberStyle: 'emoji' });
    assert.equal(output, '➖4️⃣2️⃣ 3️⃣⏺️5️⃣\n');
  });

  it('affiche une ligne vide avec 📢 seul et une fonction comme 🧩', () => {
    assert.deepEqual(outputLines('📢\n📢 🧩 👉👈 🔚'), ['', '🧩']);
  });

  it('protège l’affichage contre les listes qui se contiennent', () => {
    assert.deepEqual(outputLines('📦 📋 ⬅️ 🌜 1️⃣ 🌛\n📋🌜0️⃣🌛 ⬅️ 📋\n📢 📋'), ['🌜 🔁 🌛']);
  });
});

describe('programmes — arithmétique', () => {
  it('calcule avec les priorités habituelles', () => {
    assert.deepEqual(outputLines('📢 2️⃣ ➕ 3️⃣ ✖️ 4️⃣ 🔸 👉 2️⃣ ➕ 3️⃣ 👈 ✖️ 4️⃣ 🔸 7️⃣ ➗ 2️⃣'), ['14 20 3.5']);
  });

  it('utilise un modulo toujours positif', () => {
    assert.deepEqual(outputLines('📢 7️⃣ 🍕 3️⃣ 🔸 ➖7️⃣ 🍕 3️⃣'), ['1 2']);
  });

  it('concatène textes et listes, et répète avec ✖️', () => {
    assert.deepEqual(
      outputLines('📢 💬a💬 ➕ 1️⃣ ➕ ✅\n📢 🌜1️⃣🌛 ➕ 🌜2️⃣🌛\n📢 💬ab💬 ✖️ 3️⃣ 🔸 2️⃣ ✖️ 🌜0️⃣🌛'),
      ['a1✅', '🌜 1 🔸 2 🌛', 'ababab 🌜 0 🔸 0 🌛'],
    );
  });

  it('refuse les opérations absurdes avec un message clair', () => {
    assert.match(firstError('📢 ✅ ➕ 1️⃣').message, /additionner un booléen/);
    assert.match(firstError('📢 💬a💬 ➖ 1️⃣').message, /Impossible de calculer un texte 💬 ➖ un nombre 🔢/);
    assert.match(firstError('📢 ✅ ✖️ ❌').message, /multiplier/);
    assert.match(firstError('📢 💬a💬 ✖️ ➖1️⃣').message, /entier positif/);
    assert.match(firstError('📢 ➖ 💬a💬').message, /négatif/);
  });

  it('interdit la division par zéro', () => {
    const error = firstError('📢 1️⃣ ➗ 0️⃣');
    assert.equal(error.kind, 'exécution');
    assert.match(error.message, /Division par zéro/);
    assert.equal(error.line, 1);
    assert.match(firstError('📢 1️⃣ 🍕 0️⃣').message, /Division par zéro/);
  });
});

describe('programmes — comparaisons et logique', () => {
  it('compare nombres et textes', () => {
    assert.deepEqual(outputLines('📢 1️⃣ 🔽 2️⃣ 🔸 2️⃣ ⏫ 2️⃣ 🔸 3️⃣ ⏬ 2️⃣ 🔸 💬b💬 🔼 💬a💬'), ['✅ ✅ ❌ ✅']);
  });

  it('compare les listes en profondeur', () => {
    assert.deepEqual(outputLines('📢 🌜1️⃣ 🔸 🌜2️⃣🌛🌛 🟰 🌜1️⃣ 🔸 🌜2️⃣🌛🌛 🔸 🌜1️⃣🌛 🚫🟰 🌜2️⃣🌛'), ['✅ ✅']);
  });

  it('refuse de comparer des types différents', () => {
    assert.match(firstError('📢 1️⃣ 🔽 💬2💬').message, /comparer/);
  });

  it('court-circuite 🤝 et 🤷', () => {
    assert.deepEqual(outputLines('📢 ❌ 🤝 👉 1️⃣ ➗ 0️⃣ 🟰 1️⃣ 👈 🔸 ✅ 🤷 💬pas un booléen💬'), ['❌ ✅']);
  });

  it('exige de vrais booléens dans les conditions', () => {
    assert.match(firstError('🤔 1️⃣ 📢 2️⃣ 🔚').message, /J'attendais une condition ✅ ou ❌/);
    assert.match(firstError('📢 🚫 0️⃣').message, /condition/);
  });
});

describe('programmes — contrôle', () => {
  it('choisit la bonne branche', () => {
    const source = '🔂 🐝 📥 1️⃣ ➡️ 3️⃣\n🤔 🐝 🟰 1️⃣ 📢 💬un💬 🤨 🐝 🟰 2️⃣ 📢 💬deux💬 🙃 📢 💬trois💬 🔚\n🔚';
    assert.deepEqual(outputLines(source), ['un', 'deux', 'trois']);
  });

  it('gère 🔁, 💥 et ⏭️', () => {
    const source = [
      '📦 🐝 ⬅️ 0️⃣',
      '🔁 ✅',
      '  🐝 ⬅️ 🐝 ➕ 1️⃣',
      '  🤔 🐝 🍕 2️⃣ 🟰 0️⃣ ⏭️ 🔚',
      '  🤔 🐝 🔼 7️⃣ 💥 🔚',
      '  📢 🐝',
      '🔚',
    ].join('\n');
    assert.deepEqual(outputLines(source), ['1', '3', '5', '7']);
  });

  it('parcourt les intervalles (vides si la fin précède le début), les listes et les textes', () => {
    assert.deepEqual(outputLines('📢 1️⃣ ➡️ 3️⃣ 🔸 3️⃣ ➡️ 1️⃣\n🔂 🔡 📥 💬👨‍👩‍👧a💬 📢 🔡 🔚'), [
      '🌜 1 🔸 2 🔸 3 🌛 🌜🌛',
      '👨‍👩‍👧',
      'a',
    ]);
  });

  it('trie sans planter une liste vide ou à un élément (régression)', () => {
    const tri = readFileSync(new URL('../examples/tri.emoji', import.meta.url), 'utf8');
    const source = tri.replace(/📦 🎰 ⬅️ .*/u, '📦 🎰 ⬅️ 🌜 5️⃣ 🌛\n📢 🫧👉🌜🌛👈');
    assert.deepEqual(outputLines(source), ['🌜🌛', '🎰 🌜 5 🌛', '✨ 🌜 5 🌛']);
  });

  it('parcourt une copie de la liste', () => {
    const source = '📦 📋 ⬅️ 🌜1️⃣ 🔸 2️⃣🌛\n🔂 🐝 📥 📋\n📋 ⬅️ 📋 ➕ 🌜🐝🌛\n🔚\n📢 📋';
    assert.deepEqual(outputLines(source), ['🌜 1 🔸 2 🔸 1 🔸 2 🌛']);
  });

  it('refuse de parcourir un nombre', () => {
    assert.match(firstError('🔂 🐝 📥 5️⃣ 🔚').message, /parcourt une liste ou un texte/);
  });

  it('refuse les intervalles non entiers', () => {
    assert.match(firstError('📢 1️⃣ ➡️ 1️⃣⏺️5️⃣').message, /nombres entiers/);
  });

  it('arrête une boucle infinie au-delà du nombre d’étapes autorisé', () => {
    const error = firstError('🔁 ✅ 🔚', { maxSteps: 50 });
    assert.match(error.message, /boucle infinie/);
  });
});

describe('programmes — fonctions', () => {
  it('appelle des fonctions récursives', () => {
    const source = '🧩 ❗ 👉 🥚 👈\n🤔 🥚 ⏬ 1️⃣ ↩️ 1️⃣ 🔚\n↩️ 🥚 ✖️ ❗👉🥚 ➖ 1️⃣👈\n🔚\n📢 ❗👉🔟👈';
    assert.deepEqual(outputLines(source), ['3628800']);
  });

  it('renvoie 🕳️ sans ↩️', () => {
    assert.deepEqual(outputLines('🧩 🐇 👉👈 🔚\n📢 🐇👉👈'), ['🕳️']);
  });

  it('capture les variables (fermetures)', () => {
    const source = [
      '🧩 🏭 👉👈',
      '  📦 🧮 ⬅️ 0️⃣',
      '  ↩️ 🧩 👉👈 🧮 ⬅️ 🧮 ➕ 1️⃣ ↩️ 🧮 🔚',
      '🔚',
      '📦 🅰️ ⬅️ 🏭👉👈',
      '📦 🅱️ ⬅️ 🏭👉👈',
      '📢 🅰️👉👈 🔸 🅰️👉👈 🔸 🅱️👉👈',
    ].join('\n');
    assert.deepEqual(outputLines(source), ['1 2 1']);
  });

  it('accepte les fonctions comme valeurs', () => {
    const source = '🧩 🎁 👉 🪄 🔸 🐟 👈 ↩️ 🪄👉🪄👉🐟👈👈 🔚\n📢 🎁👉🧩👉🐝👈 ↩️ 🐝 ✖️ 3️⃣ 🔚 🔸 2️⃣👈';
    assert.deepEqual(outputLines(source), ['18']);
  });

  it('vérifie à l’exécution l’appel des valeurs et le nombre d’arguments', () => {
    assert.match(firstError('📦 🍎 ⬅️ 1️⃣\n📢 🍎👉👈').message, /pas une fonction/);
    assert.match(firstError('📦 🪄 ⬅️ 🧩 👉 🐟 👈 🔚\n📢 🪄👉👈').message, /attend 1 argument/);
  });

  it('signale une récursion infinie', () => {
    assert.match(firstError('🧩 ♾️ 👉👈 ↩️ ♾️👉👈 🔚\n📢 ♾️👉👈').message, /Récursion trop profonde/);
  });

  it('signale l’utilisation d’une variable avant son initialisation, à l’endroit de l’appel', () => {
    const source = '📢 🐇👉👈\n📦 🍎 ⬅️ 1️⃣\n🧩 🐇 👉👈 ↩️ 🍎 🔚';
    const error = firstError(source);
    assert.equal(error.kind, 'exécution');
    assert.match(error.message, /🍎 est utilisé avant d'avoir reçu sa valeur/);
    assert.equal(error.line, 1);
  });

  it('laisse une fonction utiliser une variable déclarée plus bas (régression)', () => {
    const source = '🧩 🍏 👉👈 ↩️ 🍎 🔚\n📦 🍎 ⬅️ 7️⃣\n📢 🍏👉👈';
    assert.deepEqual(outputLines(source), ['7']);
  });

  it('localise l’appel trop précoce d’une fonction remontée (régression)', () => {
    const source = ['📦 🍎 ⬅️ 1️⃣', '🤔 ✅', '  🍏👉👈', '  📦 🍎 ⬅️ 2️⃣', '  🧩 🍏 👉👈 📢 🍎 🔚', '🔚'].join('\n');
    const error = firstError(source);
    assert.equal(error.line, 3);
    assert.match(error.message, /trop tôt/);
  });

  it('permet à une fonction anonyme de s’appeler via sa variable', () => {
    const source = '📦 🔻 ⬅️ 🧩 👉 🐟 👈 🤔 🐟 ⏬ 0️⃣ ↩️ 0️⃣ 🔚 ↩️ 🐟 ➕ 🔻👉🐟 ➖ 1️⃣👈 🔚\n📢 🔻👉4️⃣👈';
    assert.deepEqual(outputLines(source), ['10']);
  });
});

describe('programmes — listes et textes', () => {
  it('lit et modifie les cases, avec indices négatifs', () => {
    const source = '📦 📋 ⬅️ 🌜 1️⃣ 🔸 2️⃣ 🔸 3️⃣ 🌛\n📋🌜0️⃣🌛 ⬅️ 9️⃣\n📢 📋🌜0️⃣🌛 🔸 📋🌜➖1️⃣🌛 🔸 📏 📋';
    assert.deepEqual(outputLines(source), ['9 3 3']);
  });

  it('traite les textes emoji par graphème', () => {
    assert.deepEqual(outputLines('📦 🧵 ⬅️ 💬👨‍👩‍👧🍹💬\n📢 📏 🧵 🔸 🧵🌜1️⃣🌛'), ['2 🍹']);
  });

  it('signale les indices invalides', () => {
    assert.match(firstError('📢 🌜1️⃣🌛🌜5️⃣🌛').message, /en dehors/);
    assert.match(firstError('📢 🌜1️⃣🌛🌜💬a💬🌛').message, /nombre entier/);
    assert.match(firstError('📢 5️⃣🌜0️⃣🌛').message, /Impossible de prendre/);
    assert.match(firstError('📦 🍎 ⬅️ 💬ab💬\n🍎🌜0️⃣🌛 ⬅️ 💬c💬').message, /texte 💬 ne se modifie pas/);
    assert.match(firstError('📦 🍎 ⬅️ 1️⃣\n🍎🌜0️⃣🌛 ⬅️ 2️⃣').message, /Impossible de modifier/);
    assert.match(firstError('📢 📏 5️⃣').message, /mesure/);
  });
});

describe('programmes — outils et entrées', () => {
  it('convertit en texte et en nombre (y compris des chiffres emoji)', () => {
    const source = '📢 🔤 1️⃣2️⃣ ➕ 💬!💬 🔸 🔢 💬4️⃣2️⃣💬 ➕ 1️⃣ 🔸 🔢 💬 ➖3.5 💬 🔸 🔢 💬abc💬 🔸 🔢 ✅ 🔸 🔢 7️⃣';
    assert.deepEqual(outputLines(source), ['12! 43 -3.5 🕳️ 🕳️ 7']);
  });

  it('lit les entrées avec 🎤 et renvoie 🕳️ à la fin', () => {
    assert.deepEqual(outputLines('📢 🎤 🔸 🎤 🔸 🎤', { inputs: ['🍎', 'b'] }), ['🍎 b 🕳️']);
  });

  it('tire des nombres avec 🎲', () => {
    assert.deepEqual(outputLines('📢 🎲 6️⃣ 🔸 🎲 6️⃣', { randoms: [0, 0.99] }), ['0 5']);
    assert.match(firstError('📢 🎲 0️⃣').message, /🎲 attend/);
  });

  it('refuse les intervalles gigantesques', () => {
    assert.match(firstError('📢 📏 👉 0️⃣ ➡️ 💯 ✖️ 💯 ✖️ 💯 ✖️ 💯 👈').message, /trop grand/);
  });

  it('répète une liste vide sans planter et borne les textes qui grossissent (régression)', () => {
    assert.deepEqual(outputLines('📢 🌜🌛 ✖️ 👉 💯 ✖️ 💯 ✖️ 💯 ✖️ 💯 ✖️ 💯 👈'), ['🌜🌛']);
    const doubling = '📦 🧵 ⬅️ 💬ab💬\n🔁 ✅\n🧵 ⬅️ 🧵 ➕ 🧵\n🔚';
    assert.match(firstError(doubling).message, /trop grand/);
    const growing = '📦 📋 ⬅️ 🌜 1️⃣ 🌛\n🔁 ✅\n📋 ⬅️ 📋 ➕ 📋\n🔚';
    assert.match(firstError(growing).message, /trop grand/);
  });

  it('relit avec 🔢 un grand nombre écrit par 🔤 (régression)', () => {
    const source = '📦 🐘 ⬅️ 🔟 ✖️ 🔟 ✖️ 🔟 ✖️ 🔟 ✖️ 🔟 ✖️ 🔟 ✖️ 🔟\n📦 🐘🐘 ⬅️ 🐘 ✖️ 🐘 ✖️ 🐘\n📢 🔢 🔤 🐘🐘 🟰 🐘🐘';
    assert.deepEqual(outputLines(source, { numberStyle: 'emoji' }), ['✅']);
  });

  it('compare une liste qui se contient elle-même (régression)', () => {
    assert.deepEqual(outputLines('📦 📋 ⬅️ 🌜 1️⃣ 🌛\n📋🌜0️⃣🌛 ⬅️ 📋\n📢 📋 🟰 📋'), ['✅']);
  });

  it('refuse proprement un programme trop imbriqué (régression)', () => {
    const deep = `📢 ${'👉 '.repeat(20_000)}1️⃣${' 👈'.repeat(20_000)}`;
    const result = compile(deep);
    assert.equal(result.ok, false);
    assert.match(result.ok ? '' : (result.errors[0]?.message ?? ''), /trop imbriqué/);
  });
});
