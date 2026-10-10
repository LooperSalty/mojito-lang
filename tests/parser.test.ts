import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MojitoError } from '../src/errors.ts';
import type { Expression, Statement } from '../src/parser/ast.ts';
import { parse } from '../src/parser/parser.ts';
import { TokenStream } from '../src/parser/token-stream.ts';

function first(source: string): Statement {
  const [statement] = parse(source).body;
  assert.ok(statement !== undefined);
  return statement;
}

function printed(source: string): Expression {
  const statement = first(`📢 ${source}`);
  assert.equal(statement.kind, 'Print');
  const [arg] = statement.args;
  assert.ok(arg !== undefined);
  return arg;
}

/** Représentation compacte d'une expression pour vérifier les priorités. */
function shape(expression: Expression): string {
  switch (expression.kind) {
    case 'Number':
      return String(expression.value);
    case 'Identifier':
      return expression.name;
    case 'Binary':
      return `(${shape(expression.left)} ${expression.operator} ${shape(expression.right)})`;
    case 'Unary':
      return `${expression.operator}(${shape(expression.operand)})`;
    case 'Call':
      return `${shape(expression.callee)}(${expression.args.map(shape).join(', ')})`;
    case 'Index':
      return `${shape(expression.object)}[${shape(expression.index)}]`;
    default:
      return expression.kind;
  }
}

function syntaxError(source: string): MojitoError {
  try {
    parse(source);
  } catch (error) {
    assert.ok(error instanceof MojitoError);
    assert.equal(error.kind, 'syntaxe');
    return error;
  }
  throw new Error('Erreur de syntaxe attendue');
}

describe('parser — expressions', () => {
  it('respecte la priorité ✖️ avant ➕', () => {
    assert.equal(shape(printed('1️⃣ ➕ 2️⃣ ✖️ 3️⃣')), '(1 + (2 * 3))');
  });

  it('est associatif à gauche', () => {
    assert.equal(shape(printed('🔟 ➖ 2️⃣ ➖ 3️⃣')), '((10 - 2) - 3)');
  });

  it('groupe avec 👉 … 👈', () => {
    assert.equal(shape(printed('👉 1️⃣ ➕ 2️⃣ 👈 ✖️ 3️⃣')), '((1 + 2) * 3)');
  });

  it('place les comparaisons sous l’arithmétique et la logique tout en bas', () => {
    assert.equal(
      shape(printed('🍎 ➕ 1️⃣ 🔼 2️⃣ 🤝 🍌 🟰 3️⃣ 🤷 🍒')),
      '((((🍎 + 1) > 2) and (🍌 == 3)) or 🍒)',
    );
  });

  it('donne à ➡️ une priorité plus faible que ➕', () => {
    assert.equal(shape(printed('0️⃣ ➡️ 🍎 ➖ 1️⃣')), '(0 range (🍎 - 1))');
  });

  it('applique les opérateurs unaires avant les binaires', () => {
    assert.equal(shape(printed('📏 🍎 ➕ ➖ 1️⃣')), '(len(🍎) + neg(1))');
    assert.equal(shape(printed('🚫 ✅')), 'not(Boolean)');
  });

  it('fait porter 🚫 sur toute la comparaison, mais pas sur 🤝 (régression)', () => {
    assert.equal(shape(printed('🚫 🍎 🟰 3️⃣')), 'not((🍎 == 3))');
    assert.equal(shape(printed('🚫 🍎 🤝 🍌')), '(not(🍎) and 🍌)');
  });

  it('enchaîne appels et indices sur la même ligne', () => {
    assert.equal(shape(printed('🍎👉1️⃣ 🔸 2️⃣👈🌜0️⃣🌛')), '🍎(1, 2)[0]');
  });

  it('lit les listes et les fonctions anonymes', () => {
    const list = printed('🌜 1️⃣ 🔸 2️⃣ 🌛');
    assert.equal(list.kind === 'List' && list.elements.length, 2);
    const fn = printed('🧩 👉 🐟 👈 ↩️ 🐟 🔚');
    assert.equal(fn.kind === 'Function' && fn.params.length, 1);
  });

  it('ne colle pas un 👉 d’une ligne suivante à l’expression précédente', () => {
    const program = parse('📦 🍎 ⬅️ 🍌\n👉 🍒 👈🌜0️⃣🌛 ⬅️ 2️⃣');
    assert.equal(program.body.length, 2);
    const [declaration] = program.body;
    assert.equal(declaration?.kind === 'VarDeclaration' && declaration.init.kind, 'Identifier');
  });
});

describe('parser — instructions', () => {
  it('lit une déclaration de variable, avec ou sans valeur', () => {
    const declaration = first('📦 🍎 ⬅️ 5️⃣');
    assert.equal(declaration.kind === 'VarDeclaration' && declaration.name, '🍎');
    const empty = first('📦 🍎');
    assert.equal(empty.kind === 'VarDeclaration' && empty.init.kind, 'Null');
  });

  it('lit si / sinon si / sinon', () => {
    const statement = first('🤔 ✅ 📢 1️⃣ 🤨 ❌ 📢 2️⃣ 🙃 📢 3️⃣ 🔚');
    assert.equal(statement.kind, 'If');
    assert.equal(statement.kind === 'If' && statement.branches.length, 2);
    assert.equal(statement.kind === 'If' && statement.otherwise?.length, 1);
  });

  it('lit les boucles, fonctions et retours', () => {
    assert.equal(first('🔁 ✅ 💥 🔚').kind, 'While');
    assert.equal(first('🔂 🐝 📥 🍎 ⏭️ 🔚').kind, 'For');
    const fn = first('🧩 🐇 👉 🅰️ 🔸 🅱️ 👈 ↩️ 🔚');
    assert.equal(fn.kind === 'FunctionDeclaration' && fn.params.length, 2);
    assert.equal(fn.kind === 'FunctionDeclaration' && fn.body[0]?.kind, 'Return');
  });

  it('distingue ↩️ seul de ↩️ suivi d’une valeur sur la même ligne', () => {
    const fn = first('🧩 🐇 👉👈\n↩️\n🐇👉👈\n🔚');
    assert.ok(fn.kind === 'FunctionDeclaration');
    const [ret, call] = fn.body;
    assert.equal(ret?.kind === 'Return' && ret.value, null);
    assert.equal(call?.kind, 'ExpressionStatement');
  });

  it('lit 📢 sans argument et avec plusieurs arguments', () => {
    const empty = first('📢\n📢 1️⃣ 🔸 2️⃣');
    assert.equal(empty.kind === 'Print' && empty.args.length, 0);
  });

  it('lit les affectations de variables et de cases', () => {
    assert.equal(first('🍎 ⬅️ 1️⃣').kind, 'Assignment');
    const indexed = first('🍎🌜0️⃣🌛 ⬅️ 1️⃣');
    assert.equal(indexed.kind === 'Assignment' && indexed.target.kind, 'Index');
  });

  it('accepte 🎤 seul comme instruction', () => {
    assert.equal(first('🎤').kind, 'ExpressionStatement');
  });
});

describe('parser — erreurs', () => {
  it('signale un bloc jamais fermé à l’endroit de son ouverture', () => {
    const error = syntaxError('📢 1️⃣\n🤔 ✅\n📢 2️⃣');
    assert.equal(error.line, 2);
    assert.match(error.message, /jamais fermé/);
  });

  it('signale un 🔚 orphelin', () => {
    assert.match(syntaxError('🔚').message, /aucun bloc ouvert/);
  });

  it('signale un ⬅️ manquant après une constante', () => {
    assert.match(syntaxError('🔒 🍎').message, /constante/);
  });

  it('refuse une expression inutile', () => {
    assert.match(syntaxError('1️⃣ ➕ 2️⃣').message, /ne fait rien/);
  });

  it('refuse d’affecter à autre chose qu’une variable', () => {
    assert.match(syntaxError('🍎👉👈 ⬅️ 1️⃣').message, /affecter/);
  });

  it('refuse une valeur manquante', () => {
    assert.match(syntaxError('📦 🍎 ⬅️ ➕').message, /J'attendais une valeur/);
  });

  it('exige les bons séparateurs', () => {
    assert.match(syntaxError('📢 🍎👉1️⃣ 2️⃣👈').message, /🔸 ou 👈/);
    assert.match(syntaxError('🔂 🐝 🍎 🔚').message, /📥/);
    assert.match(syntaxError('🧩 🐇 🔚').message, /👉/);
    assert.match(syntaxError('📢 👉 1️⃣').message, /👈/);
    assert.match(syntaxError('📢 🍎🌜1️⃣').message, /🌛/);
  });

  it('exige une liste de jetons terminée par EOF', () => {
    assert.throws(() => new TokenStream([]), /EOF/);
  });
});
