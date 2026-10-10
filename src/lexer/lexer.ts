import { MojitoError } from '../errors.ts';
import {
  canonical,
  isEmoji,
  isNewline,
  isWhitespace,
  keycapDigit,
  splitGraphemes,
  stripVariation,
} from './graphemes.ts';
import {
  COMMENT_MARKER,
  DECIMAL_POINT,
  KEYWORDS,
  NUMBER_WORDS,
  STRING_DELIMITER,
  type Token,
  type TokenType,
} from './tokens.ts';

const STRING = canonical(STRING_DELIMITER);
const COMMENT = canonical(COMMENT_MARKER);
const DECIMAL = canonical(DECIMAL_POINT);
const NOT = canonical('🚫');
const EQ = canonical('🟰');

interface Cursor {
  readonly index: number;
  readonly line: number;
  readonly col: number;
}

/** Transforme le texte source en une liste de jetons. */
export function tokenize(source: string): readonly Token[] {
  return new Lexer(source).run();
}

class Lexer {
  private readonly graphemes: readonly string[];
  private readonly tokens: Token[] = [];
  private index = 0;
  private line = 1;
  private col = 1;

  constructor(source: string) {
    this.graphemes = splitGraphemes(source);
  }

  run(): readonly Token[] {
    while (this.index < this.graphemes.length) {
      this.scanNext();
    }
    this.tokens.push({ type: 'EOF', lexeme: '', value: null, line: this.line, col: this.col, endLine: this.line, width: 0 });
    return this.tokens;
  }

  private peek(offset = 0): string {
    return this.graphemes[this.index + offset] ?? '';
  }

  private mark(): Cursor {
    return { index: this.index, line: this.line, col: this.col };
  }

  private advance(): string {
    const grapheme = this.graphemes[this.index] ?? '';
    this.index += 1;
    if (isNewline(grapheme)) {
      this.line += 1;
      this.col = 1;
    } else {
      this.col += 1;
    }
    return grapheme;
  }

  private emit(type: TokenType, start: Cursor, value: number | string | null): void {
    const lexeme = this.graphemes.slice(start.index, this.index).join('');
    this.tokens.push({
      type,
      lexeme,
      value,
      line: start.line,
      col: start.col,
      endLine: this.line,
      width: this.index - start.index,
    });
  }

  private fail(message: string, at: Cursor, width = 1): never {
    throw new MojitoError('lexicale', message, at, width);
  }

  private scanNext(): void {
    const grapheme = this.peek();
    if (isWhitespace(grapheme)) {
      this.advance();
      return;
    }
    const form = canonical(grapheme);
    if (form === COMMENT) {
      this.skipComment();
    } else if (form === STRING) {
      this.scanString();
    } else if (keycapDigit(grapheme) !== null) {
      this.scanNumber();
    } else if (form === NOT && canonical(this.peek(1)) === EQ) {
      const start = this.mark();
      this.advance();
      this.advance();
      this.emit('NEQ', start, null);
    } else if (KEYWORDS.has(form)) {
      this.scanKeyword(form);
    } else if (form === DECIMAL) {
      this.fail(`${DECIMAL_POINT} sert uniquement de virgule dans un nombre, comme 3️⃣${DECIMAL_POINT}1️⃣4️⃣.`, this.mark());
    } else if (isEmoji(grapheme)) {
      this.scanIdentifier();
    } else {
      this.fail(
        `« ${grapheme} » n'est pas un emoji. En Mojito, on code uniquement avec des emojis ! ` +
          `(le texte libre est autorisé seulement entre ${STRING_DELIMITER} … ${STRING_DELIMITER} ou après ${COMMENT_MARKER})`,
        this.mark(),
      );
    }
  }

  private scanKeyword(form: string): void {
    const start = this.mark();
    this.advance();
    const type = KEYWORDS.get(form) ?? 'IDENT';
    this.emit(type, start, NUMBER_WORDS.get(form) ?? null);
  }

  private skipComment(): void {
    while (this.index < this.graphemes.length && !isNewline(this.peek())) {
      this.advance();
    }
  }

  private scanString(): void {
    const start = this.mark();
    this.advance();
    const content: string[] = [];
    while (canonical(this.peek()) !== STRING) {
      if (this.index >= this.graphemes.length) {
        this.fail(`Ce texte n'est jamais refermé : il manque un ${STRING_DELIMITER} final.`, start);
      }
      content.push(this.advance());
    }
    this.advance();
    this.emit('STRING', start, content.join(''));
  }

  private scanDigits(): string {
    const digits: string[] = [];
    while (keycapDigit(this.peek()) !== null) {
      digits.push(String(keycapDigit(this.advance())));
    }
    return digits.join('');
  }

  private scanNumber(): void {
    const start = this.mark();
    const integerPart = this.scanDigits();
    if (canonical(this.peek()) !== DECIMAL) {
      this.emit('NUMBER', start, Number(integerPart));
      return;
    }
    const decimalAt = this.mark();
    this.advance();
    const fractionPart = this.scanDigits();
    if (fractionPart === '') {
      this.fail(`Il faut au moins un chiffre après ${DECIMAL_POINT}.`, decimalAt);
    }
    this.emit('NUMBER', start, Number(`${integerPart}.${fractionPart}`));
  }

  /** Un nom = une suite d'emojis collés (les chiffres sont permis après le premier). */
  private isIdentifierPart(grapheme: string): boolean {
    const form = canonical(grapheme);
    if (!isEmoji(grapheme) || KEYWORDS.has(form)) {
      return false;
    }
    return form !== STRING && form !== COMMENT && form !== DECIMAL;
  }

  private scanIdentifier(): void {
    const start = this.mark();
    const parts: string[] = [this.advance()];
    while (this.isIdentifierPart(this.peek())) {
      parts.push(this.advance());
    }
    this.emit('IDENT', start, parts.map(stripVariation).join(''));
  }
}
