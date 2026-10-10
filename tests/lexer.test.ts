import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MojitoError } from '../src/errors.ts';
import { canonical, isEmoji, keycapDigit, splitGraphemes } from '../src/lexer/graphemes.ts';
import { tokenize } from '../src/lexer/lexer.ts';

const types = (source: string): string[] => tokenize(source).map((token) => token.type);

function lexError(source: string): MojitoError {
  try {
    tokenize(source);
  } catch (error) {
    assert.ok(error instanceof MojitoError);
    return error;
  }
  throw new Error('Erreur lexicale attendue');
}

describe('graphèmes', () => {
  it('traite une famille ZWJ comme un seul symbole', () => {
    assert.equal(splitGraphemes('👨‍👩‍👧🍎').length, 2);
  });

  it('reconnaît les emojis et rejette les lettres et chiffres ASCII', () => {
    assert.ok(isEmoji('🍎'));
    assert.ok(isEmoji('7️⃣'));
    assert.ok(isEmoji('🇫🇷'));
    assert.ok(!isEmoji('a'));
    assert.ok(!isEmoji('7'));
  });

  it('lit les chiffres en keycap avec ou sans sélecteur de variante', () => {
    assert.equal(keycapDigit('7️⃣'), 7);
    assert.equal(keycapDigit('7⃣'), 7);
    assert.equal(keycapDigit('#️⃣'), null);
    assert.equal(keycapDigit('🍎'), null);
  });

  it('ignore variante, couleur de peau et genre dans la forme canonique', () => {
    assert.equal(canonical('⬅️'), canonical('⬅'));
    assert.equal(canonical('👉🏽'), canonical('👉'));
    assert.equal(canonical('🤷‍♀️'), canonical('🤷'));
  });
});

describe('lexer', () => {
  it('découpe une déclaration simple', () => {
    assert.deepEqual(types('📦 🍎 ⬅️ 4️⃣2️⃣'), ['LET', 'IDENT', 'ASSIGN', 'NUMBER', 'EOF']);
  });

  it('assemble les chiffres collés en un seul nombre, avec décimales', () => {
    const [integer, , decimal] = tokenize('4️⃣2️⃣ ➕ 3️⃣⏺️1️⃣4️⃣');
    assert.equal(integer?.value, 42);
    assert.equal(decimal?.value, 3.14);
  });

  it('connaît les nombres-emojis 🔟 et 💯', () => {
    const values = tokenize('🔟 💯').map((token) => token.value);
    assert.deepEqual(values, [10, 100, null]);
  });

  it('fonctionne sans espaces entre les emojis', () => {
    assert.deepEqual(types('📦🍎⬅️5️⃣'), ['LET', 'IDENT', 'ASSIGN', 'NUMBER', 'EOF']);
  });

  it('regroupe les emojis collés en un seul nom, chiffres permis après le premier', () => {
    const [first, second] = tokenize('🍎🍏 🐱1️⃣');
    assert.equal(first?.value, '🍎🍏');
    assert.equal(second?.value, '🐱1⃣');
  });

  it('accepte les mots-clés avec couleur de peau', () => {
    assert.deepEqual(types('👉🏾 👈🏻'), ['LPAREN', 'RPAREN', 'EOF']);
  });

  it('reconnaît 🚫🟰 comme « différent de » et 🚫 seul comme « non »', () => {
    assert.deepEqual(types('🚫🟰 🚫 🟰'), ['NEQ', 'NOT', 'EQ', 'EOF']);
  });

  it('lit les textes bruts entre 💬, y compris sur plusieurs lignes', () => {
    const [text, next] = tokenize('💬Salut le monde !\nça va ?💬 🍎');
    assert.equal(text?.type, 'STRING');
    assert.equal(text?.value, 'Salut le monde !\nça va ?');
    assert.equal(text?.endLine, 2);
    assert.equal(next?.line, 2);
  });

  it('ignore les commentaires 💭 jusqu’à la fin de la ligne', () => {
    assert.deepEqual(types('💭 ceci est ignoré 123\n📢'), ['PRINT', 'EOF']);
  });

  it('suit les lignes et colonnes en graphèmes', () => {
    const tokens = tokenize('📦 🍎\n  📢 🍎');
    const print = tokens.find((token) => token.type === 'PRINT');
    assert.equal(print?.line, 2);
    assert.equal(print?.col, 3);
  });

  it('refuse le texte libre en dehors des 💬', () => {
    const error = lexError('📦 x ⬅️ 1️⃣');
    assert.equal(error.kind, 'lexicale');
    assert.equal(error.col, 3);
    assert.match(error.message, /n'est pas un emoji/);
  });

  it('refuse un texte jamais refermé', () => {
    assert.match(lexError('📢 💬oups').message, /jamais refermé/);
  });

  it('refuse ⏺️ en dehors d’un nombre et sans chiffre après', () => {
    assert.match(lexError('⏺️').message, /virgule/);
    assert.match(lexError('3️⃣⏺️ 🍎').message, /au moins un chiffre/);
  });

  it('ignore le BOM et les fins de ligne Windows', () => {
    const tokens = tokenize('\uFEFF📢\r\n📢');
    assert.equal(tokens[1]?.line, 2);
  });
});
