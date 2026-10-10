import { canonical } from './graphemes.ts';

export type TokenType =
  | 'LET' | 'CONST' | 'ASSIGN' | 'PRINT' | 'INPUT'
  | 'IF' | 'ELIF' | 'ELSE' | 'END'
  | 'WHILE' | 'FOR' | 'IN' | 'BREAK' | 'CONTINUE'
  | 'FUNC' | 'RETURN'
  | 'LPAREN' | 'RPAREN' | 'LBRACKET' | 'RBRACKET' | 'COMMA'
  | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'PERCENT'
  | 'EQ' | 'NEQ' | 'GT' | 'LT' | 'GE' | 'LE'
  | 'AND' | 'OR' | 'NOT' | 'RANGE'
  | 'TRUE' | 'FALSE' | 'NULL'
  | 'RANDOM' | 'LEN' | 'TOSTR' | 'TONUM'
  | 'NUMBER' | 'STRING' | 'IDENT' | 'EOF';

export interface Token {
  readonly type: TokenType;
  /** Texte exact tel qu'écrit dans le source. */
  readonly lexeme: string;
  /** Nombre pour NUMBER, texte pour STRING, nom normalisé pour IDENT. */
  readonly value: number | string | null;
  readonly line: number;
  readonly col: number;
  /** Ligne où se termine le jeton (un texte 💬 peut tenir sur plusieurs lignes). */
  readonly endLine: number;
  /** Nombre de graphèmes occupés par le jeton. */
  readonly width: number;
}

export type KeywordCategory =
  | 'Variables' | 'Entrées / sorties' | 'Conditions' | 'Boucles' | 'Fonctions'
  | 'Opérateurs' | 'Comparaisons' | 'Logique' | 'Valeurs' | 'Outils' | 'Ponctuation';

export interface KeywordSpec {
  readonly emoji: string;
  readonly type: TokenType;
  readonly category: KeywordCategory;
  readonly meaning: string;
}

/** Délimiteurs gérés directement par le lexer. */
export const STRING_DELIMITER = '💬';
export const COMMENT_MARKER = '💭';
export const DECIMAL_POINT = '⏺️';

/** Table unique des mots-clés : sert au lexer, à la doc et au playground. */
export const KEYWORD_SPECS: readonly KeywordSpec[] = [
  { emoji: '📦', type: 'LET', category: 'Variables', meaning: 'déclarer une variable' },
  { emoji: '🔒', type: 'CONST', category: 'Variables', meaning: 'déclarer une constante' },
  { emoji: '⬅️', type: 'ASSIGN', category: 'Variables', meaning: 'affecter une valeur' },
  { emoji: '📢', type: 'PRINT', category: 'Entrées / sorties', meaning: 'afficher' },
  { emoji: '🎤', type: 'INPUT', category: 'Entrées / sorties', meaning: 'lire une ligne' },
  { emoji: '🤔', type: 'IF', category: 'Conditions', meaning: 'si' },
  { emoji: '🤨', type: 'ELIF', category: 'Conditions', meaning: 'sinon si' },
  { emoji: '🙃', type: 'ELSE', category: 'Conditions', meaning: 'sinon' },
  { emoji: '🔚', type: 'END', category: 'Conditions', meaning: 'fin de bloc' },
  { emoji: '🔁', type: 'WHILE', category: 'Boucles', meaning: 'tant que' },
  { emoji: '🔂', type: 'FOR', category: 'Boucles', meaning: 'pour chaque' },
  { emoji: '📥', type: 'IN', category: 'Boucles', meaning: 'dans' },
  { emoji: '💥', type: 'BREAK', category: 'Boucles', meaning: 'sortir de la boucle' },
  { emoji: '⏭️', type: 'CONTINUE', category: 'Boucles', meaning: 'passer au tour suivant' },
  { emoji: '🧩', type: 'FUNC', category: 'Fonctions', meaning: 'fonction' },
  { emoji: '↩️', type: 'RETURN', category: 'Fonctions', meaning: 'renvoyer' },
  { emoji: '👉', type: 'LPAREN', category: 'Ponctuation', meaning: 'ouvrir une parenthèse' },
  { emoji: '👈', type: 'RPAREN', category: 'Ponctuation', meaning: 'fermer une parenthèse' },
  { emoji: '🌜', type: 'LBRACKET', category: 'Ponctuation', meaning: 'ouvrir une liste / un indice' },
  { emoji: '🌛', type: 'RBRACKET', category: 'Ponctuation', meaning: 'fermer une liste / un indice' },
  { emoji: '🔸', type: 'COMMA', category: 'Ponctuation', meaning: 'séparateur' },
  { emoji: '➕', type: 'PLUS', category: 'Opérateurs', meaning: 'plus / concaténer' },
  { emoji: '➖', type: 'MINUS', category: 'Opérateurs', meaning: 'moins' },
  { emoji: '✖️', type: 'STAR', category: 'Opérateurs', meaning: 'fois / répéter' },
  { emoji: '➗', type: 'SLASH', category: 'Opérateurs', meaning: 'divisé par' },
  { emoji: '🍕', type: 'PERCENT', category: 'Opérateurs', meaning: 'reste (modulo)' },
  { emoji: '➡️', type: 'RANGE', category: 'Opérateurs', meaning: 'intervalle a ➡️ b' },
  { emoji: '🟰', type: 'EQ', category: 'Comparaisons', meaning: 'égal à' },
  { emoji: '🚫🟰', type: 'NEQ', category: 'Comparaisons', meaning: 'différent de' },
  { emoji: '🔼', type: 'GT', category: 'Comparaisons', meaning: 'plus grand que' },
  { emoji: '🔽', type: 'LT', category: 'Comparaisons', meaning: 'plus petit que' },
  { emoji: '⏫', type: 'GE', category: 'Comparaisons', meaning: 'plus grand ou égal' },
  { emoji: '⏬', type: 'LE', category: 'Comparaisons', meaning: 'plus petit ou égal' },
  { emoji: '🤝', type: 'AND', category: 'Logique', meaning: 'et' },
  { emoji: '🤷', type: 'OR', category: 'Logique', meaning: 'ou' },
  { emoji: '🚫', type: 'NOT', category: 'Logique', meaning: 'non' },
  { emoji: '✅', type: 'TRUE', category: 'Valeurs', meaning: 'vrai' },
  { emoji: '❌', type: 'FALSE', category: 'Valeurs', meaning: 'faux' },
  { emoji: '🕳️', type: 'NULL', category: 'Valeurs', meaning: 'rien' },
  { emoji: '🔟', type: 'NUMBER', category: 'Valeurs', meaning: 'dix' },
  { emoji: '💯', type: 'NUMBER', category: 'Valeurs', meaning: 'cent' },
  { emoji: '🎲', type: 'RANDOM', category: 'Outils', meaning: 'entier aléatoire entre 0 et n-1' },
  { emoji: '📏', type: 'LEN', category: 'Outils', meaning: "taille d'une liste / d'un texte" },
  { emoji: '🔤', type: 'TOSTR', category: 'Outils', meaning: 'convertir en texte' },
  { emoji: '🔢', type: 'TONUM', category: 'Outils', meaning: 'convertir en nombre' },
];

/** Valeur des emojis-nombres autonomes. */
export const NUMBER_WORDS: ReadonlyMap<string, number> = new Map([
  [canonical('🔟'), 10],
  [canonical('💯'), 100],
]);

/** Mots-clés d'un seul graphème, indexés par forme canonique. */
export const KEYWORDS: ReadonlyMap<string, TokenType> = new Map(
  KEYWORD_SPECS.filter((spec) => spec.emoji !== '🚫🟰').map((spec) => [canonical(spec.emoji), spec.type]),
);

const EXPRESSION_STARTERS: ReadonlySet<TokenType> = new Set<TokenType>([
  'NUMBER', 'STRING', 'TRUE', 'FALSE', 'NULL', 'IDENT', 'LPAREN', 'LBRACKET',
  'FUNC', 'INPUT', 'MINUS', 'NOT', 'LEN', 'RANDOM', 'TOSTR', 'TONUM',
]);

export function canStartExpression(type: TokenType): boolean {
  return EXPRESSION_STARTERS.has(type);
}

/** Description lisible d'un jeton pour les messages d'erreur. */
export function describeToken(token: Token): string {
  return token.type === 'EOF' ? 'la fin du fichier' : `« ${token.lexeme} »`;
}
