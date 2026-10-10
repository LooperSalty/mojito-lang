# 🍹 Mojito — le langage de programmation 100 % emoji

[![CI](https://github.com/LooperSalty/mojito-lang/actions/workflows/ci.yml/badge.svg)](https://github.com/LooperSalty/mojito-lang/actions/workflows/ci.yml)
[![Licence MIT](https://img.shields.io/badge/licence-MIT-2f7d5b.svg)](LICENSE)
![Node.js ≥ 22.18](https://img.shields.io/badge/node-%E2%89%A5%2022.18-2f7d5b.svg)

Mojito est un langage où **tout le code s'écrit en emojis** : mots-clés, opérateurs, nombres, noms de variables.
Un programme est un simple **fichier texte `.emoji`** (UTF-8 ; l'extension courte `.moj` marche aussi).
Le compilateur le transforme en JavaScript, puis l'exécute (ou produit un fichier `.js` autonome).

```
💭 FizzBuzz : 🍾 pour les multiples de 3️⃣, 🫧 pour ceux de 5️⃣
🔂 🐝 📥 1️⃣ ➡️ 1️⃣5️⃣
  🤔 🐝 🍕 1️⃣5️⃣ 🟰 0️⃣
    📢 💬🍾🫧💬
  🤨 🐝 🍕 3️⃣ 🟰 0️⃣
    📢 💬🍾💬
  🤨 🐝 🍕 5️⃣ 🟰 0️⃣
    📢 💬🫧💬
  🙃
    📢 🐝
  🔚
🔚
```

## Démarrage rapide

Il faut **Node.js 22.18 ou plus récent** (le compilateur est écrit en TypeScript, exécuté directement par Node).

```bash
git clone https://github.com/LooperSalty/mojito-lang.git
cd mojito-lang
npm install                                     # outils de développement (tests, playground, extension)
node bin/mojito.ts run examples/bonjour.emoji   # compile et exécute
node bin/mojito.ts aide                         # toutes les commandes
```

| Commande | Effet |
|---|---|
| `mojito run fichier.emoji` | compile et exécute |
| `mojito build fichier.emoji [-o sortie.js]` | produit un `.js` autonome (lancer avec `node sortie.js`, sans Mojito) |
| `mojito js fichier.emoji` | affiche le JavaScript généré |
| `mojito check fichier.emoji` | vérifie le programme sans l'exécuter |
| `mojito tokens fichier.emoji` / `mojito ast fichier.emoji` | montre les jetons / l'arbre syntaxique |

Options : `--ascii` (affiche `42` au lieu de `4️⃣2️⃣`), `--interprete` (exécute avec l'interpréteur d'AST),
`--max-etapes <n>` (stoppe une boucle infinie). Les alias français `lancer`, `compiler`, `verifier`, `aide` marchent aussi.

## Coder dans VS Code avec des fichiers `.emoji`

`npm run vscode:install` construit et installe l'extension Mojito (paquet `editors/vscode/mojito-lang-1.2.0.vsix`),
puis recharge VS Code (<kbd>Ctrl</kbd>+<kbd>Maj</kbd>+<kbd>P</kbd> › *Developer: Reload Window*). Ensuite, tout fichier
`.emoji` ouvert dans VS Code est reconnu comme du Mojito :

| Fonction | Comment |
|---|---|
| Créer un programme | *Fichier › Nouveau fichier… › Programme Mojito (.emoji)*, ou simplement un fichier `jeu.emoji` |
| Exécuter | bouton ▶ en haut de l'éditeur ou <kbd>Ctrl</kbd>+<kbd>F5</kbd> — le programme tourne dans le terminal « 🍹 Mojito », où l'on tape les entrées `🎤` ; <kbd>Ctrl</kbd>+<kbd>C</kbd> l'arrête |
| Erreurs | soulignées en rouge pendant la frappe, listées dans l'onglet *Problèmes* |
| Comprendre un emoji | survol à la souris : `🤔` → « si », avec un exemple |
| Voir le JavaScript | bouton `</>` en haut de l'éditeur |
| Compiler | clic droit › *Mojito : Compiler en JavaScript autonome* → `jeu.js` à lancer avec `node jeu.js` |
| Taper vite | snippets : un mot français puis <kbd>Tab</kbd> — `si` → `🤔 ✅ … 🔚`, `pour` → `🔂 🐝 📥 1️⃣ ➡️ 🔟 … 🔚`, `affiche` → `📢`, `plus` → `➕`, `n7` → `7️⃣` (un mot-clé seul : `si!`, `pour!`) |
| Commentaires | <kbd>Ctrl</kbd>+<kbd>:</kbd> commente la ligne avec `💭` |

L'extension embarque le compilateur et exécute les programmes **dans VS Code lui-même** (dans un thread séparé) :
ni ce dépôt ni Node.js ne sont nécessaires pour l'utiliser, et un brouillon non enregistré s'exécute aussi.
Réglage : `mojito.asciiNumbers` (affiche `42` au lieu de `4️⃣2️⃣`).

Autres façons de taper des emojis : le **playground web** (`npm run build:playground` puis `playground/dist/index.html`,
avec une palette cliquable) et, sous Windows, <kbd>Win</kbd> + <kbd>.</kbd>.

## Le langage

### Vocabulaire

| Thème | Emojis |
|---|---|
| Variables | `📦` déclarer · `🔒` constante · `⬅️` affecter |
| Entrées / sorties | `📢` afficher · `🎤` lire une ligne |
| Conditions | `🤔` si · `🤨` sinon si · `🙃` sinon · `🔚` fin de bloc |
| Boucles | `🔁` tant que · `🔂` pour chaque · `📥` dans · `💥` sortir · `⏭️` tour suivant |
| Fonctions | `🧩` fonction · `↩️` renvoyer · `👉 … 👈` paramètres, appel, parenthèses |
| Listes | `🌜 … 🌛` liste et indice · `🔸` séparateur |
| Arithmétique | `➕` `➖` `✖️` `➗` · `🍕` reste (modulo) · `➡️` intervalle |
| Comparaisons | `🟰` égal · `🚫🟰` différent · `🔼` `🔽` plus grand / petit · `⏫` `⏬` ou égal |
| Logique | `🤝` et · `🤷` ou · `🚫` non |
| Valeurs | `✅` vrai · `❌` faux · `🕳️` rien · `🔟` dix · `💯` cent |
| Outils | `🎲 n` entier au hasard de 0 à n-1 · `📏` taille · `🔤` en texte · `🔢` en nombre |
| Nombres | chiffres collés `4️⃣2️⃣` = 42 · `⏺️` virgule : `3️⃣⏺️1️⃣4️⃣` |
| Textes | `💬 n'importe quoi 💬` (seul endroit où le texte libre est permis) |
| Commentaires | `💭` jusqu'à la fin de la ligne |

Les mots-clés acceptent les variantes de couleur de peau et de genre (`👉🏽`, `🤷‍♀️`).

### Noms

Un nom est une **suite d'emojis collés** qui ne sont pas des mots-clés : `🍎`, `🍎🍏`, `🐱1️⃣`, `👨‍👩‍👧`.
Les espaces séparent les noms : `🍎 🍏` désigne deux variables. Un caractère non-emoji hors d'un texte ou d'un
commentaire est une erreur — en Mojito, on ne code qu'avec des emojis.

### Variables et affichage

```
📦 🍎 ⬅️ 4️⃣0️⃣            💭 variable
🔒 🍋 ⬅️ 2️⃣              💭 constante : 🍋 ⬅️ … est refusé
🍎 ⬅️ 🍎 ➕ 🍋
📢 💬total💬 🔸 🍎       💭 affiche « total 4️⃣2️⃣ »
```

### Conditions et boucles

Un bloc commence par son mot-clé et se termine par `🔚`. Les conditions doivent valoir `✅` ou `❌`.

```
🤔 🍎 🔼 💯
  📢 💬grand💬
🤨 🍎 🟰 💯
  📢 💬pile💬
🙃
  📢 💬petit💬
🔚

🔁 🍎 🔼 0️⃣               💭 tant que
  🍎 ⬅️ 🍎 ➖ 1️⃣
🔚

🔂 🐝 📥 1️⃣ ➡️ 5️⃣         💭 1, 2, 3, 4, 5 (vide si la fin précède le début)
  🤔 🐝 🟰 4️⃣ 💥 🔚
  📢 🐝
🔚
```

`🔂` parcourt aussi une liste ou un texte (emoji par emoji).

### Fonctions

```
🧩 🍰 👉 🅰️ 🔸 🅱️ 👈
  ↩️ 🅰️ ➕ 🅱️
🔚
📢 🍰👉 1️⃣ 🔸 2️⃣ 👈

📦 🪄 ⬅️ 🧩 👉 🐟 👈 ↩️ 🐟 ✖️ 🐟 🔚      💭 fonction anonyme
📢 🪄👉 7️⃣ 👈
```

Les fonctions sont des valeurs (passables en argument), capturent leurs variables (fermetures), peuvent être
récursives et s'utiliser avant leur déclaration dans le même bloc. Sans `↩️`, une fonction renvoie `🕳️`.

### Listes et textes

```
📦 📋 ⬅️ 🌜 3️⃣ 🔸 1️⃣ 🔸 2️⃣ 🌛
📋🌜0️⃣🌛 ⬅️ 9️⃣              💭 modifier une case
📢 📋🌜➖1️⃣🌛 🔸 📏 📋        💭 dernier élément, taille
📋 ⬅️ 📋 ➕ 🌜 4️⃣ 🌛          💭 concaténer
📢 💬🌟💬 ✖️ 3️⃣ 🔸 🌜0️⃣🌛 ✖️ 2️⃣    💭 répéter : 🌟🌟🌟 🌜 0️⃣ 🔸 0️⃣ 🌛
```

### Règles à connaître

- **Appels et indices sur la même ligne** : `🍎👉👈` et `📋🌜0️⃣🌛` doivent suivre leur nom sur la même ligne.
- **Priorités** (de la plus faible à la plus forte) : `🤷` < `🤝` < `🚫` < `🟰 🚫🟰` < `🔼 🔽 ⏫ ⏬` < `➡️` < `➕ ➖` <
  `✖️ ➗ 🍕` < `➖` unaire, `📏 🎲 🔤 🔢` < appels et indices. `🚫 🍎 🟰 3️⃣` se lit `🚫 (🍎 🟰 3️⃣)`.
- **Typage strict à l'exécution** : `✅ ➕ 1️⃣` ou une division par zéro donnent une erreur claire, avec la ligne.
- `🍕` renvoie toujours un reste du signe du diviseur (`➖7️⃣ 🍕 3️⃣` = 2️⃣).
- `🔢` accepte les chiffres emoji ou classiques et renvoie `🕳️` si le texte n'est pas un nombre.
- `➕` avec un texte convertit l'autre côté en texte : `💬score : 💬 ➕ 4️⃣2️⃣`.

### Grammaire (EBNF)

```
programme    = { instruction } ;
instruction  = déclaration | affectation | si | tantque | pour | fonction
             | "↩️" [ expr ] | "💥" | "⏭️" | "📢" [ expr { "🔸" expr } ] | appel ;
déclaration  = ( "📦" NOM [ "⬅️" expr ] ) | ( "🔒" NOM "⬅️" expr ) ;
affectation  = NOM { "🌜" expr "🌛" } "⬅️" expr ;
si           = "🤔" expr bloc { "🤨" expr bloc } [ "🙃" bloc ] "🔚" ;
tantque      = "🔁" expr bloc "🔚" ;
pour         = "🔂" NOM "📥" expr bloc "🔚" ;
fonction     = "🧩" NOM paramètres bloc "🔚" ;
paramètres   = "👉" [ NOM { "🔸" NOM } ] "👈" ;
expr         = binaire | unaire | postfixe ;
postfixe     = primaire { "👉" [ args ] "👈" | "🌜" expr "🌛" } ;
primaire     = NOMBRE | TEXTE | "✅" | "❌" | "🕳️" | "🎤" | NOM
             | "👉" expr "👈" | "🌜" [ args ] "🌛" | "🧩" paramètres bloc "🔚" ;
```

## Comment fonctionne le compilateur

```
source .emoji ──► lexer ──► parser ──► analyseur ──► générateur ──► JavaScript ──► exécution
              graphèmes    AST      portées, noms     $rt.add(…)     new Function / fichier autonome
                                         │
                                         └──────────► interpréteur d'AST (même runtime)
```

| Étape | Fichier | Rôle |
|---|---|---|
| Lexer | [src/lexer/](src/lexer/) | découpe le texte en **graphèmes** (`👨‍👩‍👧` = 1 symbole) avec `Intl.Segmenter`, reconnaît mots-clés, nombres, textes, noms |
| Parser | [src/parser/parser.ts](src/parser/parser.ts) | descente récursive + Pratt pour les priorités ; produit un AST immuable |
| Analyseur | [src/analyzer/](src/analyzer/) | portées lexicales, variables inconnues, constantes, `↩️`/`💥` mal placés, nombre d'arguments ; donne un nom JS unique à chaque variable |
| Générateur | [src/codegen/](src/codegen/) | AST → JavaScript lisible (`🍎` devient `_1f34e`, le nom emoji reste en commentaire) |
| Runtime | [src/runtime/runtime.ts](src/runtime/runtime.ts) | opérations vérifiées, affichage emoji, erreurs en français ; embarqué tel quel par `mojito build` |
| Interpréteur | [src/interpreter/](src/interpreter/) | second moteur qui parcourt l'AST : sert là où `new Function` est interdit et pour les tests différentiels |
| Extension VS Code | [editors/vscode/](editors/vscode/) | langage `.emoji`, erreurs en direct, survol, exécution, snippets générés depuis la table des mots-clés |

Exemple de JavaScript produit (`mojito js examples/fizzbuzz.emoji`) :

```js
for (let _1f41d of $rt.iter($rt.range(1, 15, "2:9"), "2:9")) { // 🐝
  $rt.tick("2:1");
  if ($rt.bool($rt.eq($rt.mod(_1f41d, 15, "3:7"), 0), "3:12")) {
    $rt.print(["🍾🫧"]);
  } else if (...) {
```

## Développement

```bash
npm test               # 185 tests : lexer, parser, analyseur, générateur, runtime, CLI, extension, E2E, différentiels
npm run test:coverage  # couverture (≈ 99 % des lignes)
npm run typecheck      # TypeScript strict
npm run verify         # tout : types, tests, playground, extension VS Code (.vsix)
```

Les tests différentiels exécutent chaque exemple et chaque cas limite avec **les deux moteurs**
(JavaScript compilé et interpréteur) et exigent une sortie identique.

## Limites connues

- Sous Windows, saisir des emojis au clavier pour `🎤` dans la console classique dépend de la page de code :
  utilise Windows Terminal avec `chcp 65001`, ou passe les entrées par un pipe (`type entrees.txt | mojito run jeu.emoji`).
  Les chiffres et lettres ASCII fonctionnent partout.
- Pas encore de dictionnaires, de modules ni de gestion d'exceptions dans le langage.
