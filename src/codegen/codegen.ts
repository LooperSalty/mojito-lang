import type {
  BinaryExpression,
  BinaryOperator,
  Expression,
  FunctionExpression,
  IfStatement,
  Loc,
  NamedNode,
  Param,
  Program,
  Statement,
  UnaryExpression,
  UnaryOperator,
} from '../parser/ast.ts';

/**
 * Générateur de code : AST Mojito → JavaScript.
 * Le code produit attend un objet `$rt` (voir runtime/runtime.ts).
 */

interface Context {
  readonly names: ReadonlyMap<NamedNode, string>;
}

const INDENT = '  ';

const BINARY_HELPERS: Partial<Readonly<Record<BinaryOperator, string>>> = {
  '+': 'add',
  '-': 'sub',
  '*': 'mul',
  '/': 'div',
  '%': 'mod',
  '<': 'lt',
  '>': 'gt',
  '<=': 'le',
  '>=': 'ge',
  range: 'range',
};

const UNARY_HELPERS: Readonly<Record<Exclude<UnaryOperator, 'not'>, string>> = {
  neg: 'neg',
  len: 'len',
  random: 'rand',
  str: 'str',
  num: 'num',
};

export function generate(program: Program, names: ReadonlyMap<NamedNode, string>): string {
  const context: Context = { names };
  return ['"use strict";', ...block(program.body, context, 0)].join('\n') + '\n';
}

function indent(depth: number, text: string): string {
  return INDENT.repeat(depth) + text;
}

function position(loc: Loc): string {
  return JSON.stringify(`${loc.line}:${loc.col}`);
}

/** Commentaire de fin de ligne rappelant le nom emoji d'origine. */
function comment(name: string): string {
  return `// ${name.replace(/[\r\n\u2028\u2029]/g, '')}`;
}

function nameOf(node: NamedNode, context: Context): string {
  const name = context.names.get(node);
  if (name === undefined) {
    throw new Error(`Nom non résolu par l'analyseur : ${node.name}`);
  }
  return name;
}

function paramList(params: readonly Param[], context: Context): string {
  return params.map((param) => nameOf(param, context)).join(', ');
}

// ─── Instructions ───────────────────────────────────────────────────────────

function block(statements: readonly Statement[], context: Context, depth: number): string[] {
  return statements.flatMap((statement) => generateStatement(statement, context, depth));
}

function generateStatement(statement: Statement, context: Context, depth: number): string[] {
  const expr = (expression: Expression): string => generateExpression(expression, context, depth);
  switch (statement.kind) {
    case 'VarDeclaration': {
      const keyword = statement.constant ? 'const' : 'let';
      return [indent(depth, `${keyword} ${nameOf(statement, context)} = ${expr(statement.init)}; ${comment(statement.name)}`)];
    }
    case 'Assignment': {
      const { target, value } = statement;
      if (target.kind === 'Identifier') {
        return [indent(depth, `${nameOf(target, context)} = ${expr(value)};`)];
      }
      const args = [expr(target.object), expr(target.index), expr(value), position(target.loc)];
      return [indent(depth, `$rt.setIndex(${args.join(', ')});`)];
    }
    case 'If':
      return generateIf(statement, context, depth);
    case 'While':
      return [
        indent(depth, `while ($rt.bool(${expr(statement.condition)}, ${position(statement.condition.loc)})) {`),
        indent(depth + 1, `$rt.tick(${position(statement.loc)});`),
        ...block(statement.body, context, depth + 1),
        indent(depth, '}'),
      ];
    case 'For': {
      const variable = nameOf(statement.variable, context);
      const iterable = `$rt.iter(${expr(statement.iterable)}, ${position(statement.iterable.loc)})`;
      return [
        indent(depth, `for (let ${variable} of ${iterable}) { ${comment(statement.variable.name)}`),
        indent(depth + 1, `$rt.tick(${position(statement.loc)});`),
        ...block(statement.body, context, depth + 1),
        indent(depth, '}'),
      ];
    }
    case 'FunctionDeclaration':
      return [
        indent(depth, `function ${nameOf(statement, context)}(${paramList(statement.params, context)}) { ${comment(statement.name)}`),
        ...block(statement.body, context, depth + 1),
        indent(depth, '}'),
      ];
    case 'Return':
      return [indent(depth, `return ${statement.value === null ? 'null' : expr(statement.value)};`)];
    case 'Break':
      return [indent(depth, 'break;')];
    case 'Continue':
      return [indent(depth, 'continue;')];
    case 'Print':
      return [indent(depth, `$rt.print([${statement.args.map(expr).join(', ')}]);`)];
    case 'ExpressionStatement':
      return [indent(depth, `${expr(statement.expression)};`)];
  }
}

function generateIf(statement: IfStatement, context: Context, depth: number): string[] {
  const branches = statement.branches.flatMap((branch, i) => {
    const keyword = i === 0 ? 'if' : '} else if';
    const condition = generateExpression(branch.condition, context, depth);
    return [
      indent(depth, `${keyword} ($rt.bool(${condition}, ${position(branch.condition.loc)})) {`),
      ...block(branch.body, context, depth + 1),
    ];
  });
  const otherwise = statement.otherwise === null
    ? []
    : [indent(depth, '} else {'), ...block(statement.otherwise, context, depth + 1)];
  return [...branches, ...otherwise, indent(depth, '}')];
}

// ─── Expressions ────────────────────────────────────────────────────────────

function generateExpression(expression: Expression, context: Context, depth: number): string {
  const expr = (inner: Expression): string => generateExpression(inner, context, depth);
  switch (expression.kind) {
    case 'Number':
      return String(expression.value);
    case 'String':
      return JSON.stringify(expression.value);
    case 'Boolean':
      return String(expression.value);
    case 'Null':
      return 'null';
    case 'Input':
      return '$rt.input()';
    case 'Identifier':
      return nameOf(expression, context);
    case 'List':
      return `[${expression.elements.map(expr).join(', ')}]`;
    case 'Binary':
      return generateBinary(expression, expr);
    case 'Unary':
      return generateUnary(expression, expr);
    case 'Call':
      return `$rt.call(${expr(expression.callee)}, [${expression.args.map(expr).join(', ')}], ${position(expression.loc)})`;
    case 'Index':
      return `$rt.index(${expr(expression.object)}, ${expr(expression.index)}, ${position(expression.loc)})`;
    case 'Function':
      return generateFunctionExpression(expression, context, depth);
  }
}

function generateBinary(expression: BinaryExpression, expr: (e: Expression) => string): string {
  const { operator, left, right } = expression;
  switch (operator) {
    case '==':
      return `$rt.eq(${expr(left)}, ${expr(right)})`;
    case '!=':
      return `!$rt.eq(${expr(left)}, ${expr(right)})`;
    case 'and':
    case 'or': {
      const symbol = operator === 'and' ? '&&' : '||';
      return `($rt.bool(${expr(left)}, ${position(left.loc)}) ${symbol} $rt.bool(${expr(right)}, ${position(right.loc)}))`;
    }
    default:
      return `$rt.${BINARY_HELPERS[operator] ?? 'add'}(${expr(left)}, ${expr(right)}, ${position(expression.loc)})`;
  }
}

function generateUnary(expression: UnaryExpression, expr: (e: Expression) => string): string {
  const operand = expr(expression.operand);
  const where = position(expression.loc);
  switch (expression.operator) {
    case 'not':
      return `!$rt.bool(${operand}, ${where})`;
    case 'str':
    case 'num':
      return `$rt.${UNARY_HELPERS[expression.operator]}(${operand})`;
    default:
      return `$rt.${UNARY_HELPERS[expression.operator]}(${operand}, ${where})`;
  }
}

function generateFunctionExpression(expression: FunctionExpression, context: Context, depth: number): string {
  return [
    `(function (${paramList(expression.params, context)}) {`,
    ...block(expression.body, context, depth + 1),
    indent(depth, '})'),
  ].join('\n');
}
