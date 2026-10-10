import type { Position } from '../errors.ts';

export type Loc = Position;

// ─── Expressions ────────────────────────────────────────────────────────────

export type BinaryOperator =
  | '+' | '-' | '*' | '/' | '%'
  | '==' | '!=' | '<' | '>' | '<=' | '>='
  | 'and' | 'or' | 'range';

export type UnaryOperator = 'neg' | 'not' | 'len' | 'random' | 'str' | 'num';

export interface NumberLiteral { readonly kind: 'Number'; readonly value: number; readonly loc: Loc }
export interface StringLiteral { readonly kind: 'String'; readonly value: string; readonly loc: Loc }
export interface BooleanLiteral { readonly kind: 'Boolean'; readonly value: boolean; readonly loc: Loc }
export interface NullLiteral { readonly kind: 'Null'; readonly loc: Loc }
export interface Identifier { readonly kind: 'Identifier'; readonly name: string; readonly loc: Loc }
export interface InputExpression { readonly kind: 'Input'; readonly loc: Loc }

export interface ListLiteral {
  readonly kind: 'List';
  readonly elements: readonly Expression[];
  readonly loc: Loc;
}

export interface BinaryExpression {
  readonly kind: 'Binary';
  readonly operator: BinaryOperator;
  readonly left: Expression;
  readonly right: Expression;
  readonly loc: Loc;
}

export interface UnaryExpression {
  readonly kind: 'Unary';
  readonly operator: UnaryOperator;
  readonly operand: Expression;
  readonly loc: Loc;
}

export interface CallExpression {
  readonly kind: 'Call';
  readonly callee: Expression;
  readonly args: readonly Expression[];
  readonly loc: Loc;
}

export interface IndexExpression {
  readonly kind: 'Index';
  readonly object: Expression;
  readonly index: Expression;
  readonly loc: Loc;
}

/** Paramètre de fonction ou variable de boucle 🔂. */
export interface Param { readonly kind: 'Param'; readonly name: string; readonly loc: Loc }

export interface FunctionExpression {
  readonly kind: 'Function';
  readonly params: readonly Param[];
  readonly body: readonly Statement[];
  readonly loc: Loc;
}

export type Expression =
  | NumberLiteral | StringLiteral | BooleanLiteral | NullLiteral | ListLiteral
  | Identifier | BinaryExpression | UnaryExpression | CallExpression
  | IndexExpression | FunctionExpression | InputExpression;

// ─── Instructions ───────────────────────────────────────────────────────────

export interface VarDeclaration {
  readonly kind: 'VarDeclaration';
  readonly constant: boolean;
  readonly name: string;
  readonly init: Expression;
  readonly loc: Loc;
}

export interface Assignment {
  readonly kind: 'Assignment';
  readonly target: Identifier | IndexExpression;
  readonly value: Expression;
  readonly loc: Loc;
}

export interface ConditionalBranch {
  readonly condition: Expression;
  readonly body: readonly Statement[];
}

export interface IfStatement {
  readonly kind: 'If';
  readonly branches: readonly ConditionalBranch[];
  readonly otherwise: readonly Statement[] | null;
  readonly loc: Loc;
}

export interface WhileStatement {
  readonly kind: 'While';
  readonly condition: Expression;
  readonly body: readonly Statement[];
  readonly loc: Loc;
}

export interface ForStatement {
  readonly kind: 'For';
  readonly variable: Param;
  readonly iterable: Expression;
  readonly body: readonly Statement[];
  readonly loc: Loc;
}

export interface FunctionDeclaration {
  readonly kind: 'FunctionDeclaration';
  readonly name: string;
  readonly params: readonly Param[];
  readonly body: readonly Statement[];
  readonly loc: Loc;
}

export interface ReturnStatement { readonly kind: 'Return'; readonly value: Expression | null; readonly loc: Loc }
export interface BreakStatement { readonly kind: 'Break'; readonly loc: Loc }
export interface ContinueStatement { readonly kind: 'Continue'; readonly loc: Loc }
export interface PrintStatement { readonly kind: 'Print'; readonly args: readonly Expression[]; readonly loc: Loc }
export interface ExpressionStatement { readonly kind: 'ExpressionStatement'; readonly expression: Expression; readonly loc: Loc }

export type Statement =
  | VarDeclaration | Assignment | IfStatement | WhileStatement | ForStatement
  | FunctionDeclaration | ReturnStatement | BreakStatement | ContinueStatement
  | PrintStatement | ExpressionStatement;

export interface Program {
  readonly kind: 'Program';
  readonly body: readonly Statement[];
}

/** Tout nœud qui introduit ou référence un nom (clé de la table des noms). */
export type NamedNode = Identifier | Param | VarDeclaration | FunctionDeclaration;
