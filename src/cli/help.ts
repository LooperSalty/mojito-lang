import { KEYWORD_SPECS, type KeywordCategory } from '../lexer/tokens.ts';

export const VERSION = '1.0.0';

function keywordTable(): string {
  const categories = [...new Set(KEYWORD_SPECS.map((spec) => spec.category))];
  return categories
    .map((category: KeywordCategory) => {
      const entries = KEYWORD_SPECS.filter((spec) => spec.category === category)
        .map((spec) => `${spec.emoji} ${spec.meaning}`)
        .join('   ');
      return `  ${category.padEnd(18)} ${entries}`;
    })
    .join('\n');
}

export function helpText(): string {
  return `🍹 Mojito ${VERSION} — le langage de programmation 100 % emoji

Utilisation :
  mojito run <fichier.emoji>            compile et exécute le programme
  mojito build <fichier.emoji> [-o x]   compile vers un fichier JavaScript autonome
  mojito js <fichier.emoji>             affiche le JavaScript généré
  mojito check <fichier.emoji>          vérifie le programme sans l'exécuter
  mojito tokens <fichier.emoji>         affiche les jetons (lexer)
  mojito ast <fichier.emoji>            affiche l'arbre syntaxique (parser)
  mojito aide | version

Les programmes sont de simples fichiers texte en UTF-8 : extension .emoji (ou .moj).

Options :
  --ascii             affiche les nombres en chiffres classiques (42 au lieu de 4️⃣2️⃣)
  --max-etapes <n>    arrête le programme après n tours de boucle
  --interprete        exécute avec l'interpréteur d'AST au lieu du JavaScript compilé
  -o, --output <x>    fichier de sortie pour « build »

Vocabulaire :
${keywordTable()}
  Nombres            0️⃣ … 9️⃣ collés (4️⃣2️⃣ = 42), ⏺️ pour la virgule (3️⃣⏺️1️⃣4️⃣)
  Textes             💬 n'importe quoi 💬
  Commentaires       💭 jusqu'à la fin de la ligne
`;
}
