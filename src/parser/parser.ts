import { tokenize } from '../lexer/lexer.ts';
import { canStartExpression, describeToken, type Token, type TokenType } from '../lexer/tokens.ts';
import type {
  BinaryOperator,
  ConditionalBranch,
  Expression,
  FunctionDeclaration,
  IfStatement,
  Param,
  Program,
  Statement,
  UnaryOperator,
} from './ast.ts';
import { TokenStream, locOf } from './token-stream.ts';

interface BinaryInfo {
  readonly precedence: number;
  readonly operator: BinaryOperator;
}

/** Priorités (de la plus faible à la plus forte). */
const BINARY_OPERATORS: Partial<Readonly<Record<TokenType, BinaryInfo>>> = {
  OR: { precedence: 1, operator: 'or' },
  AND: { precedence: 2, operator: 'and' },
  EQ: { precedence: 3, operator: '==' },
  NEQ: { precedence: 3, operator: '!=' },
  GT: { precedence: 4, operator: '>' },
  LT: { precedence: 4, operator: '<' },
  GE: { precedence: 4, operator: '>=' },
  LE: { precedence: 4, operator: '<=' },
  RANGE: { precedence: 5, operator: 'range' },
  PLUS: { precedence: 6, operator: '+' },
  MINUS: { precedence: 6, operator: '-' },
  STAR: { precedence: 7, operator: '*' },
  SLASH: { precedence: 7, operator: '/' },
  PERCENT: { precedence: 7, operator: '%' },
};

const UNARY_OPERATORS: Partial<Readonly<Record<TokenType, UnaryOperator>>> = {
  MINUS: 'neg',
  NOT: 'not',
  LEN: 'len',
  RANDOM: 'random',
  TOSTR: 'str',
  TONUM: 'num',
};

/** 🚫 s'applique à tout ce qui est plus prioritaire que 🤝 et 🤷. */
const NOT_OPERAND_PRECEDENCE = 3;

const BLOCK_CLOSERS: ReadonlySet<TokenType> = new Set<TokenType>(['END', 'ELSE', 'ELIF']);

/** Analyse un programme Mojito complet (texte → AST). */
export function parse(source: string): Program {
  return parseTokens(tokenize(source));
}

export function parseTokens(tokens: readonly Token[]): Program {
  return new Parser(new TokenStream(tokens)).parseProgram();
}

class Parser {
  private readonly stream: TokenStream;

  constructor(stream: TokenStream) {
    this.stream = stream;
  }

  parseProgram(): Program {
    const body: Statement[] = [];
    while (!this.stream.isAtEnd()) {
      body.push(this.parseStatement());
    }
    return { kind: 'Program', body };
  }

  // ─── Instructions ─────────────────────────────────────────────────────────

  private parseStatement(): Statement {
    const token = this.stream.peek();
    switch (token.type) {
      case 'LET':
      case 'CONST':
        return this.parseVarDeclaration();
      case 'IF':
        return this.parseIf();
      case 'WHILE':
        return this.parseWhile();
      case 'FOR':
        return this.parseFor();
      case 'FUNC':
        return this.stream.peek(1).type === 'IDENT' ? this.parseFunctionDeclaration() : this.parseSimpleStatement();
      case 'RETURN':
        return this.parseReturn();
      case 'BREAK':
        return { kind: 'Break', loc: locOf(this.stream.advance()) };
      case 'CONTINUE':
        return { kind: 'Continue', loc: locOf(this.stream.advance()) };
      case 'PRINT':
        return this.parsePrint();
      default:
        if (BLOCK_CLOSERS.has(token.type)) {
          throw this.stream.error(`${describeToken(token)} inattendu : aucun bloc ouvert à cet endroit.`);
        }
        return this.parseSimpleStatement();
    }
  }

  /** Lit des instructions jusqu'à l'un des jetons de fermeture (non consommé). */
  private parseBlock(opener: Token, closers: readonly TokenType[]): Statement[] {
    const body: Statement[] = [];
    while (!closers.includes(this.stream.peek().type)) {
      if (this.stream.isAtEnd()) {
        throw this.stream.error(
          `Le bloc ouvert par ${opener.lexeme} à la ligne ${opener.line} n'est jamais fermé par 🔚.`,
          opener,
        );
      }
      body.push(this.parseStatement());
    }
    return body;
  }

  private expectEnd(opener: Token): void {
    this.stream.expect('END', `Il manque 🔚 pour fermer le ${opener.lexeme} de la ligne ${opener.line}`);
  }

  private parseVarDeclaration(): Statement {
    const keyword = this.stream.advance();
    const constant = keyword.type === 'CONST';
    const name = this.stream.expect('IDENT', `J'attendais un nom (un emoji) après ${keyword.lexeme}`);
    const hasValue = this.stream.match('ASSIGN') !== null;
    if (!hasValue && constant) {
      throw this.stream.error(`Une constante 🔒 doit recevoir une valeur avec ⬅️.`);
    }
    const init: Expression = hasValue ? this.parseExpression() : { kind: 'Null', loc: locOf(name) };
    return { kind: 'VarDeclaration', constant, name: String(name.value), init, loc: locOf(name) };
  }

  private parseIf(): IfStatement {
    const opener = this.stream.advance();
    const branches: ConditionalBranch[] = [];
    let otherwise: Statement[] | null = null;
    let clauseToken = opener;
    for (;;) {
      const condition = this.parseExpression();
      branches.push({ condition, body: this.parseBlock(clauseToken, ['ELIF', 'ELSE', 'END']) });
      const next = this.stream.match('ELIF');
      if (next === null) {
        break;
      }
      clauseToken = next;
    }
    const elseToken = this.stream.match('ELSE');
    if (elseToken !== null) {
      otherwise = this.parseBlock(elseToken, ['END']);
    }
    this.expectEnd(opener);
    return { kind: 'If', branches, otherwise, loc: locOf(opener) };
  }

  private parseWhile(): Statement {
    const opener = this.stream.advance();
    const condition = this.parseExpression();
    const body = this.parseBlock(opener, ['END']);
    this.expectEnd(opener);
    return { kind: 'While', condition, body, loc: locOf(opener) };
  }

  private parseFor(): Statement {
    const opener = this.stream.advance();
    const name = this.stream.expect('IDENT', "J'attendais le nom de la variable de boucle après 🔂");
    this.stream.expect('IN', "J'attendais 📥 après la variable de boucle");
    const iterable = this.parseExpression();
    const body = this.parseBlock(opener, ['END']);
    this.expectEnd(opener);
    const variable: Param = { kind: 'Param', name: String(name.value), loc: locOf(name) };
    return { kind: 'For', variable, iterable, body, loc: locOf(opener) };
  }

  private parseParams(): Param[] {
    this.stream.expect('LPAREN', "J'attendais 👉 pour ouvrir la liste des paramètres");
    const params: Param[] = [];
    if (this.stream.match('RPAREN') !== null) {
      return params;
    }
    do {
      const name = this.stream.expect('IDENT', "J'attendais un nom de paramètre (un emoji)");
      params.push({ kind: 'Param', name: String(name.value), loc: locOf(name) });
    } while (this.stream.match('COMMA') !== null);
    this.stream.expect('RPAREN', "J'attendais 👈 pour fermer la liste des paramètres");
    return params;
  }

  private parseFunctionDeclaration(): FunctionDeclaration {
    const opener = this.stream.advance();
    const name = this.stream.advance();
    const params = this.parseParams();
    const body = this.parseBlock(opener, ['END']);
    this.expectEnd(opener);
    return { kind: 'FunctionDeclaration', name: String(name.value), params, body, loc: locOf(name) };
  }

  private parseReturn(): Statement {
    const keyword = this.stream.advance();
    const hasValue = this.stream.onSameLine() && canStartExpression(this.stream.peek().type);
    return { kind: 'Return', value: hasValue ? this.parseExpression() : null, loc: locOf(keyword) };
  }

  private parsePrint(): Statement {
    const keyword = this.stream.advance();
    const args: Expression[] = [];
    if (this.stream.onSameLine() && canStartExpression(this.stream.peek().type)) {
      do {
        args.push(this.parseExpression());
      } while (this.stream.match('COMMA') !== null);
    }
    return { kind: 'Print', args, loc: locOf(keyword) };
  }

  /** Affectation (cible ⬅️ valeur) ou appel de fonction isolé. */
  private parseSimpleStatement(): Statement {
    const start = this.stream.peek();
    const expression = this.parseExpression();
    const arrow = this.stream.match('ASSIGN');
    if (arrow !== null) {
      if (expression.kind !== 'Identifier' && expression.kind !== 'Index') {
        throw this.stream.error('On ne peut affecter ⬅️ qu’à une variable ou à une case de liste.', arrow);
      }
      return { kind: 'Assignment', target: expression, value: this.parseExpression(), loc: locOf(arrow) };
    }
    if (expression.kind !== 'Call' && expression.kind !== 'Input') {
      throw this.stream.error(
        'Cette expression ne fait rien toute seule. Affiche-la avec 📢 ou range-la avec 📦 … ⬅️.',
        start,
      );
    }
    return { kind: 'ExpressionStatement', expression, loc: locOf(start) };
  }

  // ─── Expressions (Pratt) ──────────────────────────────────────────────────

  private parseExpression(minPrecedence = 1): Expression {
    let left = this.parseUnary();
    for (;;) {
      const info = BINARY_OPERATORS[this.stream.peek().type];
      if (info === undefined || info.precedence < minPrecedence) {
        return left;
      }
      const operatorToken = this.stream.advance();
      const right = this.parseExpression(info.precedence + 1);
      left = { kind: 'Binary', operator: info.operator, left, right, loc: locOf(operatorToken) };
    }
  }

  private parseUnary(): Expression {
    const operator = UNARY_OPERATORS[this.stream.peek().type];
    if (operator === undefined) {
      return this.parsePostfix(this.parsePrimary());
    }
    const token = this.stream.advance();
    // Comme « not » en Python, 🚫 englobe la comparaison qui suit : 🚫 🍎 🟰 3️⃣ = 🚫 (🍎 🟰 3️⃣).
    const operand = operator === 'not' ? this.parseExpression(NOT_OPERAND_PRECEDENCE) : this.parseUnary();
    return { kind: 'Unary', operator, operand, loc: locOf(token) };
  }

  /** Appels 👉…👈 et indices 🌜…🌛, uniquement sur la même ligne. */
  private parsePostfix(base: Expression): Expression {
    let expression = base;
    while (this.stream.onSameLine()) {
      const call = this.stream.match('LPAREN');
      if (call !== null) {
        const args = this.parseArguments('RPAREN', '👈');
        expression = { kind: 'Call', callee: expression, args, loc: locOf(call) };
        continue;
      }
      const index = this.stream.match('LBRACKET');
      if (index === null) {
        break;
      }
      const position = this.parseExpression();
      this.stream.expect('RBRACKET', "J'attendais 🌛 pour fermer l'indice");
      expression = { kind: 'Index', object: expression, index: position, loc: locOf(index) };
    }
    return expression;
  }

  private parseArguments(closer: TokenType, closerEmoji: string): Expression[] {
    const args: Expression[] = [];
    if (this.stream.match(closer) !== null) {
      return args;
    }
    do {
      args.push(this.parseExpression());
    } while (this.stream.match('COMMA') !== null);
    this.stream.expect(closer, `J'attendais 🔸 ou ${closerEmoji}`);
    return args;
  }

  private parsePrimary(): Expression {
    const token = this.stream.advance();
    const loc = locOf(token);
    switch (token.type) {
      case 'NUMBER':
        return { kind: 'Number', value: Number(token.value), loc };
      case 'STRING':
        return { kind: 'String', value: String(token.value), loc };
      case 'TRUE':
      case 'FALSE':
        return { kind: 'Boolean', value: token.type === 'TRUE', loc };
      case 'NULL':
        return { kind: 'Null', loc };
      case 'IDENT':
        return { kind: 'Identifier', name: String(token.value), loc };
      case 'INPUT':
        return { kind: 'Input', loc };
      case 'LBRACKET':
        return { kind: 'List', elements: this.parseArguments('RBRACKET', '🌛'), loc };
      case 'LPAREN': {
        const inner = this.parseExpression();
        this.stream.expect('RPAREN', "J'attendais 👈 pour fermer la parenthèse");
        return inner;
      }
      case 'FUNC': {
        const params = this.parseParams();
        const body = this.parseBlock(token, ['END']);
        this.expectEnd(token);
        return { kind: 'Function', params, body, loc };
      }
      default:
        throw this.stream.error(`J'attendais une valeur, mais j'ai trouvé ${describeToken(token)}.`, token);
    }
  }
}
