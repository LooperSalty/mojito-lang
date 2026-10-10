/**
 * Outils Unicode : un « caractère » Mojito est un graphème (ce que l'œil voit
 * comme un seul symbole), pas un point de code. 👨‍👩‍👧 compte pour un seul emoji.
 */

const segmenter = new Intl.Segmenter('fr', { granularity: 'grapheme' });

const VARIATION_SELECTORS = /[\uFE0E\uFE0F]/gu;
const SKIN_TONES = /[\u{1F3FB}-\u{1F3FF}]/gu;
const GENDER_SUFFIX = /\u200D[♀♂]$/u;
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const PRESENTATION = /\p{Emoji_Presentation}/u;
const REGIONAL_INDICATOR = /\p{Regional_Indicator}/u;
const WHITESPACE = /^\s+$/u;
const KEYCAP = '\u20E3';

export function splitGraphemes(text: string): readonly string[] {
  return Array.from(segmenter.segment(text), (part) => part.segment);
}

/** Retire les sélecteurs de variante : ⬅️ et ⬅ deviennent identiques. */
export function stripVariation(grapheme: string): string {
  return grapheme.replace(VARIATION_SELECTORS, '');
}

/**
 * Forme canonique utilisée pour reconnaître les mots-clés : on ignore aussi
 * la couleur de peau et le genre (👉🏽 et 🤷‍♀️ restent des mots-clés).
 */
export function canonical(grapheme: string): string {
  return stripVariation(grapheme).replace(SKIN_TONES, '').replace(GENDER_SUFFIX, '');
}

export function isEmoji(grapheme: string): boolean {
  return (
    PICTOGRAPHIC.test(grapheme) ||
    PRESENTATION.test(grapheme) ||
    REGIONAL_INDICATOR.test(grapheme) ||
    grapheme.includes(KEYCAP)
  );
}

export function isWhitespace(grapheme: string): boolean {
  return WHITESPACE.test(grapheme);
}

export function isNewline(grapheme: string): boolean {
  return grapheme === '\n' || grapheme === '\r\n' || grapheme === '\r';
}

/** 7️⃣ → 7, sinon null. */
export function keycapDigit(grapheme: string): number | null {
  const bare = stripVariation(grapheme);
  if (bare.length !== 2 || bare[1] !== KEYCAP) {
    return null;
  }
  const digit = bare.charCodeAt(0) - 48;
  return digit >= 0 && digit <= 9 ? digit : null;
}

/** Largeur approximative à l'écran (les emojis occupent deux colonnes). */
export function displayWidth(grapheme: string): number {
  return isEmoji(grapheme) ? 2 : 1;
}
