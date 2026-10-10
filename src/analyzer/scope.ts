import type { Loc } from '../parser/ast.ts';

export type BindingKind = 'variable' | 'constante' | 'fonction' | 'paramètre' | 'boucle';

export interface Binding {
  readonly name: string;
  readonly kind: BindingKind;
  readonly loc: Loc;
  /** Nom JavaScript unique attribué par le compilateur. */
  readonly jsName: string;
}

/** Une portée lexicale : un bloc, une fonction ou le programme entier. */
export class Scope {
  readonly parent: Scope | null;
  private readonly bindings = new Map<string, Binding>();

  constructor(parent: Scope | null) {
    this.parent = parent;
  }

  add(binding: Binding): void {
    this.bindings.set(binding.name, binding);
  }

  lookupLocal(name: string): Binding | undefined {
    return this.bindings.get(name);
  }

  lookup(name: string): Binding | undefined {
    return this.bindings.get(name) ?? this.parent?.lookup(name);
  }
}
