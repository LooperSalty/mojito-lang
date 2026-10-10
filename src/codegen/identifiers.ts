/**
 * Les emojis ne sont pas des identifiants JavaScript valides : 🍎 devient
 * `_1f34e` (code hexadécimal de chaque point de code, séparés par `_`).
 */
export function mangle(name: string): string {
  const codes = Array.from(name, (char) => (char.codePointAt(0) ?? 0).toString(16));
  return `_${codes.join('_')}`;
}

const MANGLED = /^_([0-9a-f]+(?:_[0-9a-f]+)*)(?:\$\d+)?$/;

/** Opération inverse de `mangle` (ignore le suffixe `$n` de désambiguïsation). */
export function demangle(jsName: string): string | null {
  const match = MANGLED.exec(jsName);
  if (match === null || match[1] === undefined) {
    return null;
  }
  return String.fromCodePoint(...match[1].split('_').map((hex) => parseInt(hex, 16)));
}
