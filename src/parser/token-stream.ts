import { MojitoError } from '../errors.ts';
import { describeToken, type Token, type TokenType } from '../lexer/tokens.ts';
import type { Loc } from './ast.ts';

/** Curseur de lecture sur la liste de jetons produite par le lexer. */
export class TokenStream {
  private readonly tokens: readonly Token[];
  private index = 0;

  constructor(tokens: readonly Token[]) {
    if (tokens.length === 0 || tokens[tokens.length - 1]?.type !== 'EOF') {
      throw new Error('La liste de jetons doit se terminer par EOF');
    }
    this.tokens = tokens;
  }

  peek(offset = 0): Token {
    const last = this.tokens[this.tokens.length - 1] as Token;
    return this.tokens[this.index + offset] ?? last;
  }

  previous(): Token {
    return this.tokens[Math.max(this.index - 1, 0)] as Token;
  }

  check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  isAtEnd(): boolean {
    return this.check('EOF');
  }

  advance(): Token {
    const token = this.peek();
    if (!this.isAtEnd()) {
      this.index += 1;
    }
    return token;
  }

  match(type: TokenType): Token | null {
    return this.check(type) ? this.advance() : null;
  }

  expect(type: TokenType, message: string): Token {
    const token = this.match(type);
    if (token === null) {
      throw this.error(`${message} (trouvé : ${describeToken(this.peek())})`);
    }
    return token;
  }

  /** Vrai si le prochain jeton est sur la même ligne que le précédent. */
  onSameLine(): boolean {
    return this.index > 0 && this.peek().line === this.previous().endLine;
  }

  error(message: string, token: Token = this.peek()): MojitoError {
    return new MojitoError('syntaxe', message, token, Math.max(token.width, 1));
  }
}

export function locOf(token: Token): Loc {
  return { line: token.line, col: token.col };
}
