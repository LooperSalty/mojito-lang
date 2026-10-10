export interface ExampleMeta {
  readonly file: string;
  readonly label: string;
  /** Lignes proposées dans la zone d'entrées 🎤. */
  readonly inputs: string;
}

/** Ordre et libellés des exemples dans le menu (les sources viennent de examples/). */
export const EXAMPLE_META: readonly ExampleMeta[] = [
  { file: 'bonjour.emoji', label: '👋 Bonjour', inputs: '' },
  { file: 'fizzbuzz.emoji', label: '🍾 FizzBuzz', inputs: '' },
  { file: 'fibonacci.emoji', label: '🐇 Fibonacci', inputs: '' },
  { file: 'factorielle.emoji', label: '❗ Factorielle', inputs: '' },
  { file: 'tri.emoji', label: '🫧 Tri à bulles', inputs: '' },
  { file: 'premiers.emoji', label: '🏺 Nombres premiers', inputs: '' },
  { file: 'carres.emoji', label: "🗺️ Fonctions d'ordre supérieur", inputs: '' },
  { file: 'compteur.emoji', label: '🏭 Fermetures', inputs: '' },
  { file: 'pyramide.emoji', label: '🔺 Pyramide', inputs: '' },
  { file: 'devine.emoji', label: '🎯 Devine le nombre', inputs: '50\n25\n75\n🍌\n12\n88' },
];

export const DEFAULT_EXAMPLE = 'fizzbuzz.emoji';

/** Emojis proposés pour nommer ses variables (aucun n'est un mot-clé). */
export const NAME_SUGGESTIONS: readonly string[] = [
  '🍎', '🍌', '🍒', '🍋', '🐱', '🐝', '🐇', '🐢', '🦊', '🧮', '📋', '🎯', '🪄', '🌟', '🧱', '🎈',
];

export const NUMBER_KEYS: readonly string[] = [
  '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '⏺️',
];
