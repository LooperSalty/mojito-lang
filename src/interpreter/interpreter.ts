import type {
  Assignment,
  BinaryExpression,
  Expression,
  ForStatement,
  IfStatement,
  Loc,
  NamedNode,
  Param,
  Program,
  Statement,
  UnaryExpression,
  WhileStatement,
} from '../parser/ast.ts';
import type { MojitoFunction, MojitoValue, Runtime } from '../runtime/runtime.ts';

/**
 * Second moteur d'exécution : parcourt directement l'AST au lieu de générer
 * du JavaScript. Il partage le runtime et la résolution des noms du
 * compilateur, donc la même sémantique. Utile là où `new Function` est
 * interdit (pages web à CSP stricte) et pour les tests différentiels.
 */

type Completion =
  | { readonly type: 'normal' }
  | { readonly type: 'break' }
  | { readonly type: 'continue' }
  | { readonly type: 'return'; readonly value: MojitoValue };

const NORMAL: Completion = { type: 'normal' };
const BREAK: Completion = { type: 'break' };
const CONTINUE: Completion = { type: 'continue' };

class Environment {
  private readonly parent: Environment | null;
  private readonly values = new Map<string, MojitoValue>();

  constructor(parent: Environment | null) {
    this.parent = parent;
  }

  define(key: string, value: MojitoValue): void {
    this.values.set(key, value);
  }

  find(key: string): Environment | null {
    return this.values.has(key) ? this : (this.parent?.find(key) ?? null);
  }

  read(key: string): MojitoValue {
    return this.values.get(key) ?? null;
  }
}

export function interpret(program: Program, names: ReadonlyMap<NamedNode, string>, runtime: Runtime): void {
  new Interpreter(names, runtime).block(program.body, new Environment(null));
}

function position(loc: Loc): string {
  return `${loc.line}:${loc.col}`;
}

class Interpreter {
  private readonly names: ReadonlyMap<NamedNode, string>;
  private readonly rt: Runtime;

  constructor(names: ReadonlyMap<NamedNode, string>, runtime: Runtime) {
    this.names = names;
    this.rt = runtime;
  }

  private key(node: NamedNode): string {
    return this.names.get(node) ?? node.name;
  }

  /** Les fonctions d'un bloc existent dès l'entrée dans le bloc (remontée). */
  block(statements: readonly Statement[], env: Environment): Completion {
    for (const statement of statements) {
      if (statement.kind === 'FunctionDeclaration') {
        env.define(this.key(statement), this.makeFunction(statement.params, statement.body, env));
      }
    }
    for (const statement of statements) {
      const completion = this.statement(statement, env);
      if (completion.type !== 'normal') {
        return completion;
      }
    }
    return NORMAL;
  }

  private statement(statement: Statement, env: Environment): Completion {
    switch (statement.kind) {
      case 'VarDeclaration':
        env.define(this.key(statement), this.evaluate(statement.init, env));
        return NORMAL;
      case 'Assignment':
        this.assign(statement, env);
        return NORMAL;
      case 'If':
        return this.ifStatement(statement, env);
      case 'While':
        return this.whileStatement(statement, env);
      case 'For':
        return this.forStatement(statement, env);
      case 'FunctionDeclaration':
        return NORMAL;
      case 'Return':
        return { type: 'return', value: statement.value === null ? null : this.evaluate(statement.value, env) };
      case 'Break':
        return BREAK;
      case 'Continue':
        return CONTINUE;
      case 'Print':
        this.rt.print(statement.args.map((arg) => this.evaluate(arg, env)));
        return NORMAL;
      case 'ExpressionStatement':
        this.evaluate(statement.expression, env);
        return NORMAL;
    }
  }

  private ifStatement(statement: IfStatement, env: Environment): Completion {
    for (const branch of statement.branches) {
      if (this.rt.bool(this.evaluate(branch.condition, env), position(branch.condition.loc))) {
        return this.block(branch.body, new Environment(env));
      }
    }
    return statement.otherwise === null ? NORMAL : this.block(statement.otherwise, new Environment(env));
  }

  /** Une itération terminée par 💥 arrête la boucle ; ↩️ la traverse. */
  private loopExit(completion: Completion): Completion | null {
    if (completion.type === 'break') return NORMAL;
    return completion.type === 'return' ? completion : null;
  }

  private whileStatement(statement: WhileStatement, env: Environment): Completion {
    while (this.rt.bool(this.evaluate(statement.condition, env), position(statement.condition.loc))) {
      this.rt.tick(position(statement.loc));
      const exit = this.loopExit(this.block(statement.body, new Environment(env)));
      if (exit !== null) return exit;
    }
    return NORMAL;
  }

  private forStatement(statement: ForStatement, env: Environment): Completion {
    const items = this.rt.iter(this.evaluate(statement.iterable, env), position(statement.iterable.loc));
    for (const item of items) {
      this.rt.tick(position(statement.loc));
      const loopEnv = new Environment(env);
      loopEnv.define(this.key(statement.variable), item);
      const exit = this.loopExit(this.block(statement.body, loopEnv));
      if (exit !== null) return exit;
    }
    return NORMAL;
  }

  private assign(statement: Assignment, env: Environment): void {
    const { target } = statement;
    if (target.kind === 'Index') {
      const container = this.evaluate(target.object, env);
      const index = this.evaluate(target.index, env);
      this.rt.setIndex(container, index, this.evaluate(statement.value, env), position(target.loc));
      return;
    }
    const value = this.evaluate(statement.value, env);
    const key = this.key(target);
    const owner = env.find(key) ?? this.rt.uninitialized(target.name, position(target.loc));
    owner.define(key, value);
  }

  private evaluate(expression: Expression, env: Environment): MojitoValue {
    switch (expression.kind) {
      case 'Number':
      case 'String':
      case 'Boolean':
        return expression.value;
      case 'Null':
        return null;
      case 'Input':
        return this.rt.input();
      case 'Identifier': {
        const key = this.key(expression);
        const owner = env.find(key);
        if (owner === null) {
          return this.rt.uninitialized(expression.name, position(expression.loc));
        }
        return owner.read(key);
      }
      case 'List':
        return expression.elements.map((element) => this.evaluate(element, env));
      case 'Binary':
        return this.binary(expression, env);
      case 'Unary':
        return this.unary(expression, env);
      case 'Call': {
        const callee = this.evaluate(expression.callee, env);
        const args = expression.args.map((arg) => this.evaluate(arg, env));
        return this.rt.call(callee, args, position(expression.loc));
      }
      case 'Index':
        return this.rt.index(this.evaluate(expression.object, env), this.evaluate(expression.index, env), position(expression.loc));
      case 'Function':
        return this.makeFunction(expression.params, expression.body, env);
    }
  }

  private binary(expression: BinaryExpression, env: Environment): MojitoValue {
    const { operator, left, right } = expression;
    const where = position(expression.loc);
    if (operator === 'and' || operator === 'or') {
      const first = this.rt.bool(this.evaluate(left, env), position(left.loc));
      if (first === (operator === 'or')) {
        return first;
      }
      return this.rt.bool(this.evaluate(right, env), position(right.loc));
    }
    const a = this.evaluate(left, env);
    const b = this.evaluate(right, env);
    switch (operator) {
      case '+': return this.rt.add(a, b, where);
      case '-': return this.rt.sub(a, b, where);
      case '*': return this.rt.mul(a, b, where);
      case '/': return this.rt.div(a, b, where);
      case '%': return this.rt.mod(a, b, where);
      case '==': return this.rt.eq(a, b);
      case '!=': return !this.rt.eq(a, b);
      case '<': return this.rt.lt(a, b, where);
      case '>': return this.rt.gt(a, b, where);
      case '<=': return this.rt.le(a, b, where);
      case '>=': return this.rt.ge(a, b, where);
      case 'range': return this.rt.range(a, b, where);
    }
  }

  private unary(expression: UnaryExpression, env: Environment): MojitoValue {
    const value = this.evaluate(expression.operand, env);
    const where = position(expression.loc);
    switch (expression.operator) {
      case 'neg': return this.rt.neg(value, where);
      case 'not': return !this.rt.bool(value, where);
      case 'len': return this.rt.len(value, where);
      case 'random': return this.rt.rand(value, where);
      case 'str': return this.rt.str(value);
      case 'num': return this.rt.num(value);
    }
  }

  private makeFunction(params: readonly Param[], body: readonly Statement[], closure: Environment): MojitoFunction {
    const keys = params.map((param) => this.key(param));
    const fn = (...args: MojitoValue[]): MojitoValue => {
      const local = new Environment(closure);
      keys.forEach((key, i) => local.define(key, args[i] ?? null));
      const completion = this.block(body, local);
      return completion.type === 'return' ? completion.value : null;
    };
    // `$rt.call` vérifie le nombre d'arguments via `length`, comme pour le JS compilé.
    return Object.defineProperty(fn, 'length', { value: params.length });
  }
}
