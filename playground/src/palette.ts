import { KEYWORD_SPECS } from '../../src/lexer/tokens.ts';
import { NAME_SUGGESTIONS, NUMBER_KEYS } from './examples.ts';

export interface PaletteKey {
  readonly emoji: string;
  readonly meaning: string;
}

export interface PaletteGroup {
  readonly title: string;
  readonly keys: readonly PaletteKey[];
}

const DIGIT_MEANINGS: Readonly<Record<string, string>> = { '⏺️': 'virgule décimale' };

/** Groupes de la palette, construits depuis la table des mots-clés du compilateur. */
export function paletteGroups(): readonly PaletteGroup[] {
  const categories = [...new Set(KEYWORD_SPECS.map((spec) => spec.category))];
  const keywordGroups = categories.map((category) => ({
    title: category,
    keys: KEYWORD_SPECS.filter((spec) => spec.category === category).map(({ emoji, meaning }) => ({ emoji, meaning })),
  }));
  return [
    ...keywordGroups,
    {
      title: 'Nombres',
      keys: NUMBER_KEYS.map((emoji, digit) => ({ emoji, meaning: DIGIT_MEANINGS[emoji] ?? `chiffre ${digit}` })),
    },
    {
      title: 'Textes & notes',
      keys: [
        { emoji: '💬', meaning: 'début / fin de texte' },
        { emoji: '💭', meaning: "commentaire jusqu'à la fin de la ligne" },
      ],
    },
    {
      title: 'Noms',
      keys: NAME_SUGGESTIONS.map((emoji) => ({ emoji, meaning: 'nom libre pour une variable ou une fonction' })),
    },
  ];
}

export function renderPalette(
  container: HTMLElement,
  onPick: (key: PaletteKey) => void,
): void {
  const fragment = document.createDocumentFragment();
  for (const group of paletteGroups()) {
    const section = document.createElement('div');
    section.className = 'palette-group';
    const title = document.createElement('span');
    title.className = 'palette-title';
    title.textContent = group.title;
    const keys = document.createElement('div');
    keys.className = 'palette-keys';
    for (const key of group.keys) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'key';
      button.textContent = key.emoji;
      button.title = `${key.emoji} ${key.meaning}`;
      button.setAttribute('aria-label', `${key.emoji} : ${key.meaning}`);
      button.addEventListener('click', () => onPick(key));
      keys.append(button);
    }
    section.append(title, keys);
    fragment.append(section);
  }
  container.replaceChildren(fragment);
}
