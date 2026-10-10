import { MojitoError } from '../errors.ts';
import { mangle } from '../codegen/identifiers.ts';
import { splitGraphemes } from '../lexer/graphemes.ts';
import type {
  Assignment,
  Expression,
  ForStatement,
  Identifier,
  Loc,
  NamedNode,
  Param,
  Program,
  Statement,
} from '../parser/ast.ts';
import { Scope, type Binding, type BindingKind } from './scope.ts';

export interface AnalysisResult {
  readonly errors: readonly MojitoError[];
  /** Nom JavaScript unique de chaque déclaration et de chaque référence. */
  readonly names: ReadonlyMap<NamedNode, string>;
}

interface Context {
  readonly inFunction: boolean;
  readonly inLoop: boolean;
}

type Declarable = Exclude<NamedNode, Identifier>;

/** Vérifie la cohérence du programme et résout chaque nom vers sa déclaration. */
export function analyze(program: Program): AnalysisResult {
  return new Analyzer().run(program);
}

class Analyzer {
  private readonly errors: MojitoError[] = [];
  private readonly names = new Map<NamedNode, string>();
  private readonly usedJsNames = new Map<string, number>();
  private readonly arities = new Map<Binding, number>();
  /**
   * Corps de fonctions en attente : ils sont analysés une fois toute la
   * fonction (ou le programme) englobante parcourue, pour voir les variables
   * déclarées plus bas — comme en JavaScript ou en Python.
   */
  private deferred: (() => void)[] = [];

  run(program: Program): AnalysisResult {
    this.block(program.body, new Scope(null), { inFunction: false, inLoop: false });
    this.drainDeferred();
    const errors = [...this.errors].sort((a, b) => a.line - b.line || a.col - b.col);
    return { errors, names: this.names };
  }

  private drainDeferred(): void {
    for (let next = this.deferred.shift(); next !== undefined; next = this.deferred.shift()) {
      next();
    }
  }

  private deferFunctionBody(params: readonly Param[], body: readonly Statement[], scope: Scope): void {
    this.deferred.push(() => this.functionBody(params, body, scope));
  }

  private report(message: string, loc: Loc, name = ''): void {
    const width = Math.max(splitGraphemes(name).length, 1);
    this.errors.push(new MojitoError('sémantique', message, loc, width));
  }

  private uniqueJsName(name: string): string {
    const base = mangle(name);
    const count = this.usedJsNames.get(base) ?? 0;
    this.usedJsNames.set(base, count + 1);
    return count === 0 ? base : `${base}$${count}`;
  }

  private bind(scope: Scope, node: Declarable, kind: BindingKind): Binding {
    const existing = scope.lookupLocal(node.name);
    if (existing !== undefined) {
      this.report(`${node.name} est déjà déclaré dans ce bloc (ligne ${existing.loc.line}).`, node.loc, node.name);
      this.names.set(node, existing.jsName);
      return existing;
    }
    const binding: Binding = { name: node.name, kind, loc: node.loc, jsName: this.uniqueJsName(node.name) };
    scope.add(binding);
    this.names.set(node, binding.jsName);
    return binding;
  }

  private resolve(identifier: Identifier, scope: Scope): Binding | undefined {
    const binding = scope.lookup(identifier.name);
    if (binding === undefined) {
      this.report(
        `${identifier.name} n'existe pas ici. Déclare-le d'abord avec 📦 ${identifier.name} ⬅️ …`,
        identifier.loc,
        identifier.name,
      );
      this.names.set(identifier, mangle(identifier.name));
      return undefined;
    }
    this.names.set(identifier, binding.jsName);
    return binding;
  }

  /** Les fonctions sont « remontées » : utilisables avant leur déclaration dans le bloc. */
  private block(statements: readonly Statement[], scope: Scope, context: Context): void {
    for (const statement of statements) {
      if (statement.kind === 'FunctionDeclaration') {
        const binding = this.bind(scope, statement, 'fonction');
        this.arities.set(binding, statement.params.length);
      }
    }
    for (const statement of statements) {
      this.statement(statement, scope, context);
    }
  }

  private functionBody(params: readonly Param[], body: readonly Statement[], scope: Scope): void {
    const outerQueue = this.deferred;
    this.deferred = [];
    const functionScope = new Scope(scope);
    for (const param of params) {
      this.bind(functionScope, param, 'paramètre');
    }
    this.block(body, functionScope, { inFunction: true, inLoop: false });
    this.drainDeferred();
    this.deferred = outerQueue;
  }

  private statement(statement: Statement, scope: Scope, context: Context): void {
    switch (statement.kind) {
      case 'VarDeclaration':
        this.expression(statement.init, scope);
        this.bind(scope, statement, statement.constant ? 'constante' : 'variable');
        return;
      case 'Assignment':
        this.assignment(statement, scope);
        return;
      case 'If':
        for (const branch of statement.branches) {
          this.expression(branch.condition, scope);
          this.block(branch.body, new Scope(scope), context);
        }
        if (statement.otherwise !== null) {
          this.block(statement.otherwise, new Scope(scope), context);
        }
        return;
      case 'While':
        this.expression(statement.condition, scope);
        this.block(statement.body, new Scope(scope), { ...context, inLoop: true });
        return;
      case 'For':
        this.forStatement(statement, scope, context);
        return;
      case 'FunctionDeclaration':
        this.deferFunctionBody(statement.params, statement.body, scope);
        return;
      case 'Return':
        if (!context.inFunction) {
          this.report("↩️ ne peut s'utiliser que dans une fonction 🧩.", statement.loc);
        }
        if (statement.value !== null) {
          this.expression(statement.value, scope);
        }
        return;
      case 'Break':
      case 'Continue':
        if (!context.inLoop) {
          const emoji = statement.kind === 'Break' ? '💥' : '⏭️';
          this.report(`${emoji} ne peut s'utiliser que dans une boucle 🔁 ou 🔂.`, statement.loc);
        }
        return;
      case 'Print':
        statement.args.forEach((arg) => this.expression(arg, scope));
        return;
      case 'ExpressionStatement':
        this.expression(statement.expression, scope);
        return;
    }
  }

  private assignment(statement: Assignment, scope: Scope): void {
    this.expression(statement.value, scope);
    const target = statement.target;
    if (target.kind === 'Index') {
      this.expression(target.object, scope);
      this.expression(target.index, scope);
      return;
    }
    const binding = this.resolve(target, scope);
    if (binding?.kind === 'constante') {
      this.report(`${target.name} est une constante 🔒 : sa valeur ne peut pas changer.`, target.loc, target.name);
    } else if (binding?.kind === 'fonction') {
      this.report(`${target.name} est une fonction 🧩 : on ne peut pas la remplacer.`, target.loc, target.name);
    }
  }

  private forStatement(statement: ForStatement, scope: Scope, context: Context): void {
    this.expression(statement.iterable, scope);
    const loopScope = new Scope(scope);
    this.bind(loopScope, statement.variable, 'boucle');
    this.block(statement.body, loopScope, { ...context, inLoop: true });
  }

  private expression(expression: Expression, scope: Scope): void {
    switch (expression.kind) {
      case 'Number':
      case 'String':
      case 'Boolean':
      case 'Null':
      case 'Input':
        return;
      case 'Identifier':
        this.resolve(expression, scope);
        return;
      case 'List':
        expression.elements.forEach((element) => this.expression(element, scope));
        return;
      case 'Binary':
        this.expression(expression.left, scope);
        this.expression(expression.right, scope);
        return;
      case 'Unary':
        this.expression(expression.operand, scope);
        return;
      case 'Index':
        this.expression(expression.object, scope);
        this.expression(expression.index, scope);
        return;
      case 'Call':
        this.call(expression.callee, expression.args, scope, expression.loc);
        return;
      case 'Function':
        this.deferFunctionBody(expression.params, expression.body, scope);
        return;
    }
  }

  private call(callee: Expression, args: readonly Expression[], scope: Scope, loc: Loc): void {
    this.expression(callee, scope);
    args.forEach((arg) => this.expression(arg, scope));
    if (callee.kind !== 'Identifier') {
      return;
    }
    const binding = scope.lookup(callee.name);
    const arity = binding === undefined ? undefined : this.arities.get(binding);
    if (arity !== undefined && arity !== args.length) {
      this.report(`${callee.name} attend ${arity} argument(s), mais en reçoit ${args.length}.`, loc);
    }
  }
}
