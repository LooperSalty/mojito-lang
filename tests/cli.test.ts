import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { main, type CliEnvironment } from '../src/cli/main.ts';
import { formatDiagnostic, MojitoError } from '../src/errors.ts';
import { createFakeIO } from './helpers.ts';

interface FakeCli {
  readonly env: CliEnvironment;
  readonly stdout: () => string;
  readonly stderr: () => string;
  readonly written: ReadonlyMap<string, string>;
}

function fakeCli(files: Readonly<Record<string, string>>, inputs: readonly string[] = []): FakeCli {
  const out: string[] = [];
  const err: string[] = [];
  const written = new Map<string, string>();
  const io = createFakeIO({ inputs });
  const env: CliEnvironment = {
    readFile: (path) => {
      const content = files[path];
      if (content === undefined) {
        throw Object.assign(new Error('absent'), { code: 'ENOENT' });
      }
      return content;
    },
    writeFile: (path, content) => {
      written.set(path, content);
    },
    stdout: (text) => {
      out.push(text);
    },
    stderr: (text) => {
      err.push(text);
    },
    io: { ...io, write: (text) => out.push(text) },
  };
  return { env, stdout: () => out.join(''), stderr: () => err.join(''), written };
}

const HELLO = { 'hello.emoji': '📢 💬👋💬 🔸 4️⃣2️⃣' };

describe('CLI', () => {
  it('exécute un programme', () => {
    const cli = fakeCli(HELLO);
    assert.equal(main(['run', 'hello.emoji'], cli.env), 0);
    assert.equal(cli.stdout(), '👋 4️⃣2️⃣\n');
  });

  it('accepte --ascii et l’alias « lancer »', () => {
    const cli = fakeCli(HELLO);
    assert.equal(main(['lancer', 'hello.emoji', '--ascii'], cli.env), 0);
    assert.equal(cli.stdout(), '👋 42\n');
  });

  it('affiche l’aide et la version', () => {
    const help = fakeCli({});
    assert.equal(main([], help.env), 0);
    assert.match(help.stdout(), /mojito run/);
    assert.match(help.stdout(), /📦 déclarer une variable/);
    const version = fakeCli({});
    assert.equal(main(['--version'], version.env), 0);
    assert.match(version.stdout(), /Mojito \d+\.\d+\.\d+/);
  });

  it('refuse une commande inconnue ou un fichier manquant', () => {
    const unknown = fakeCli({});
    assert.equal(main(['danser'], unknown.env), 2);
    assert.match(unknown.stderr(), /Commande inconnue/);
    const missing = fakeCli({});
    assert.equal(main(['run'], missing.env), 2);
    const absent = fakeCli({});
    assert.equal(main(['run', 'absent.emoji'], absent.env), 1);
    assert.match(absent.stderr(), /fichier introuvable/);
  });

  it('refuse les options invalides', () => {
    assert.equal(main(['run', 'a.emoji', '--inconnue'], fakeCli({}).env), 2);
    assert.equal(main(['run', 'a.emoji', '--max-etapes', 'beaucoup'], fakeCli({}).env), 2);
    assert.equal(main(['run', 'a.emoji', 'b.emoji'], fakeCli({}).env), 2);
  });

  it('affiche les erreurs de compilation avec le code source', () => {
    const cli = fakeCli({ 'bug.emoji': '📦 🍎 ⬅️ 1️⃣\n📢 🍌' });
    assert.equal(main(['run', 'bug.emoji'], cli.env), 1);
    assert.match(cli.stderr(), /🧠 Erreur sémantique — bug\.emoji:2:3/);
    assert.match(cli.stderr(), /2 │ 📢 🍌\n {3}│ {4}\^\^/);
  });

  it('affiche les erreurs d’exécution', () => {
    const cli = fakeCli({ 'div.emoji': '📢 1️⃣ ➗ 0️⃣' });
    assert.equal(main(['run', 'div.emoji'], cli.env), 1);
    assert.match(cli.stderr(), /💥 Erreur d'exécution — div\.emoji:1:5/);
  });

  it('applique --max-etapes', () => {
    const cli = fakeCli({ 'boucle.emoji': '🔁 ✅ 🔚' });
    assert.equal(main(['run', 'boucle.emoji', '--max-etapes', '10'], cli.env), 1);
    assert.match(cli.stderr(), /boucle infinie/);
  });

  it('vérifie, affiche le JS, les jetons et l’AST', () => {
    const check = fakeCli(HELLO);
    assert.equal(main(['check', 'hello.emoji'], check.env), 0);
    assert.match(check.stdout(), /Aucune erreur/);
    const js = fakeCli(HELLO);
    assert.equal(main(['js', 'hello.emoji'], js.env), 0);
    assert.match(js.stdout(), /\$rt\.print\(\["👋", 42\]\);/);
    const tokens = fakeCli(HELLO);
    assert.equal(main(['tokens', 'hello.emoji'], tokens.env), 0);
    assert.match(tokens.stdout(), /1:1 +PRINT +📢/);
    const ast = fakeCli(HELLO);
    assert.equal(main(['ast', 'hello.emoji'], ast.env), 0);
    assert.equal(JSON.parse(ast.stdout()).kind, 'Program');
  });

  it('signale les erreurs lexicales dans « tokens » et syntaxiques dans « ast »', () => {
    const tokens = fakeCli({ 'x.emoji': 'abc' });
    assert.equal(main(['tokens', 'x.emoji'], tokens.env), 1);
    assert.match(tokens.stderr(), /Erreur lexicale/);
    const ast = fakeCli({ 'x.emoji': '🔚' });
    assert.equal(main(['ast', 'x.emoji'], ast.env), 1);
    assert.match(ast.stderr(), /Erreur de syntaxe/);
  });

  it('compile vers un fichier autonome', () => {
    const cli = fakeCli(HELLO);
    assert.equal(main(['build', 'hello.emoji'], cli.env), 0);
    const output = cli.written.get('hello.js');
    assert.ok(output !== undefined);
    assert.ok(output.startsWith('#!/usr/bin/env node'));
    assert.match(cli.stdout(), /hello\.emoji ➡️ hello\.js/);
  });

  it('refuse d’écraser le fichier source, même écrit autrement (régression)', () => {
    for (const output of ['hello.emoji', './hello.emoji', 'sous/../hello.emoji']) {
      const cli = fakeCli(HELLO);
      assert.equal(main(['build', 'hello.emoji', '-o', output], cli.env), 2);
      assert.equal(cli.written.size, 0);
    }
  });

  it('exécute avec l’interpréteur sur demande', () => {
    const cli = fakeCli(HELLO);
    assert.equal(main(['run', 'hello.emoji', '--interprete', '--ascii'], cli.env), 0);
    assert.equal(cli.stdout(), '👋 42\n');
    const failing = fakeCli({ 'div.emoji': '📢 1️⃣ ➗ 0️⃣' });
    assert.equal(main(['run', 'div.emoji', '--interprete'], failing.env), 1);
  });

  it('ne confond pas une commande avec une propriété d’objet', () => {
    assert.equal(main(['toString'], fakeCli({}).env), 2);
  });
});

describe('mise en forme des erreurs', () => {
  it('souligne la bonne colonne en tenant compte de la largeur des emojis', () => {
    const error = new MojitoError('syntaxe', 'oups', { line: 1, col: 3 }, 2);
    assert.equal(formatDiagnostic(error, '📦 🍎🍏', 'f.emoji'), [
      '🧱 Erreur de syntaxe — f.emoji:1:3',
      ' 1 │ 📦 🍎🍏',
      '   │    ^^^^',
      '  👉 oups',
    ].join('\n'));
  });

  it('se passe d’extrait quand la position est inconnue', () => {
    const text = formatDiagnostic({ kind: 'exécution', message: 'boom', line: 0, col: 0, width: 1 }, '📢');
    assert.equal(text, "💥 Erreur d'exécution — <source>\n  👉 boom");
  });
});
