/** Extensions des fichiers source Mojito : `.emoji` (recommandée) et `.moj` (alias court). */
export const SOURCE_EXTENSIONS: readonly string[] = ['.emoji', '.moj'];

const SOURCE_EXTENSION = /\.(emoji|moj)$/i;

export function isSourceFile(path: string): boolean {
  return SOURCE_EXTENSION.test(path);
}

/** `jeu.emoji` → `jeu.js` (un nom sans extension Mojito reçoit simplement `.js`). */
export function compiledOutputPath(path: string): string {
  return `${path.replace(SOURCE_EXTENSION, '')}.js`;
}
