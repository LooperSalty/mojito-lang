import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KEYWORD_SPECS } from '../../src/lexer/tokens.ts';

/**
 * Génère les snippets de l'extension VS Code à partir de la table des
 * mots-clés : on tape un mot français (« si », « pour »…) puis Tab, et
 * l'emoji correspondant apparaît.
 */

const OUTPUT = fileURLToPath(new URL('../../editors/vscode/snippets/mojito.json', import.meta.url));

/** Alias français de chaque mot-clé (le build échoue s'il en manque un). */
const WORDS: Readonly<Record<string, string>> = {
  '📦': 'var', '🔒': 'const', '⬅️': 'prend', '📢': 'affiche', '🎤': 'lire',
  '🤔': 'si', '🤨': 'sinonsi', '🙃': 'sinon', '🔚': 'fin',
  '🔁': 'tantque', '🔂': 'pour', '📥': 'dans', '💥': 'stop', '⏭️': 'suivant',
  '🧩': 'fonction', '↩️': 'retour',
  '👉': 'ouvre', '👈': 'ferme', '🌜': 'crochet', '🌛': 'fincrochet', '🔸': 'virgule',
  '➕': 'plus', '➖': 'moins', '✖️': 'fois', '➗': 'divise', '🍕': 'modulo', '➡️': 'jusqua',
  '🟰': 'egal', '🚫🟰': 'different', '🔼': 'sup', '🔽': 'inf', '⏫': 'supegal', '⏬': 'infegal',
  '🤝': 'et', '🤷': 'ou', '🚫': 'non',
  '✅': 'vrai', '❌': 'faux', '🕳️': 'rien', '🔟': 'dix', '💯': 'cent',
  '🎲': 'hasard', '📏': 'taille', '🔤': 'entexte', '🔢': 'ennombre',
};

const KEYCAPS = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

interface Snippet {
  readonly prefix: string;
  readonly body: string | readonly string[];
  readonly description: string;
}

/** Blocs complets, plus pratiques que les mots-clés seuls. */
const BLOCKS: Readonly<Record<string, Snippet>> = {
  'bloc si': { prefix: 'si', body: ['🤔 ${1:✅}', '  $0', '🔚'], description: '🤔 si … 🔚' },
  'bloc si sinon': { prefix: 'sisinon', body: ['🤔 ${1:✅}', '  $2', '🙃', '  $0', '🔚'], description: '🤔 si … 🙃 sinon … 🔚' },
  'bloc tant que': { prefix: 'tantque', body: ['🔁 ${1:✅}', '  $0', '🔚'], description: '🔁 tant que … 🔚' },
  'bloc pour': {
    prefix: 'pour',
    body: ['🔂 ${1:🐝} 📥 ${2:1️⃣ ➡️ 🔟}', '  $0', '🔚'],
    description: '🔂 pour chaque … 📥 … 🔚',
  },
  'bloc fonction': {
    prefix: 'fonction',
    body: ['🧩 ${1:🍰} 👉 ${2:🍎} 👈', '  $0', '🔚'],
    description: '🧩 fonction 👉 paramètres 👈 … 🔚',
  },
  'variable': { prefix: 'var', body: '📦 ${1:🍎} ⬅️ $0', description: '📦 déclarer une variable' },
  'constante': { prefix: 'const', body: '🔒 ${1:🍋} ⬅️ $0', description: '🔒 déclarer une constante' },
  'texte': { prefix: 'texte', body: '💬$1💬$0', description: '💬 texte 💬' },
  'liste': { prefix: 'liste', body: '🌜 $1 🌛$0', description: '🌜 liste 🌛' },
  'parenthèses': { prefix: 'paren', body: '👉 $1 👈$0', description: '👉 … 👈' },
  'commentaire': { prefix: 'comm', body: '💭 $0', description: '💭 commentaire' },
  'virgule décimale': { prefix: 'point', body: '⏺️', description: '⏺️ virgule des nombres décimaux' },
};

function keywordSnippets(): Record<string, Snippet> {
  const missing = KEYWORD_SPECS.filter((spec) => WORDS[spec.emoji] === undefined);
  if (missing.length > 0) {
    throw new Error(`Alias manquant pour : ${missing.map((spec) => spec.emoji).join(' ')}`);
  }
  const blockPrefixes = new Set(Object.values(BLOCKS).map((snippet) => snippet.prefix));
  return Object.fromEntries(
    KEYWORD_SPECS.map((spec) => {
      const word = WORDS[spec.emoji] ?? spec.emoji;
      const prefix = blockPrefixes.has(word) ? `${word}!` : word;
      return [`${spec.emoji} ${spec.meaning}`, { prefix, body: `${spec.emoji} `, description: `${spec.emoji} ${spec.meaning}` }];
    }),
  );
}

function digitSnippets(): Record<string, Snippet> {
  return Object.fromEntries(
    KEYCAPS.map((emoji, digit) => [`chiffre ${digit}`, { prefix: `n${digit}`, body: emoji, description: `${emoji} chiffre ${digit}` }]),
  );
}

/** Écrit editors/vscode/snippets/mojito.json et renvoie le nombre de snippets. */
export function writeSnippets(): number {
  const snippets = { ...BLOCKS, ...keywordSnippets(), ...digitSnippets() };
  mkdirSync(join(OUTPUT, '..'), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(snippets, null, 2)}\n`, 'utf8');
  return Object.keys(snippets).length;
}
