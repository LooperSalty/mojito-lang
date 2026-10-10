import type { RuntimeIO } from './runtime.ts';

/**
 * Entrées/sorties sur la console Node.js.
 *
 * ⚠️ Comme `createRuntime`, cette fonction doit rester AUTONOME : elle est
 * recopiée dans les programmes compilés par `mojito build`.
 *
 * La lecture se fait par blocs (et non octet par octet) pour ne jamais couper
 * un emoji en deux ; les octets en trop sont gardés pour la ligne suivante.
 */
export function createNodeIO(): RuntimeIO {
  // getBuiltinModule marche en ESM comme en CommonJS (Node 20.16+) ; sinon on se rabat sur require.
  const fs: typeof import('node:fs') = typeof process.getBuiltinModule === 'function'
    ? process.getBuiltinModule('node:fs')
    : require('node:fs');
  const STDIN = 0;
  const CHUNK_SIZE = 4096;
  const NEWLINE = 0x0a;
  const pause = new Int32Array(new SharedArrayBuffer(4));
  let pending = Buffer.alloc(0);
  let ended = false;

  const readChunk = (): Buffer | null => {
    const buffer = Buffer.alloc(CHUNK_SIZE);
    for (;;) {
      try {
        const read = fs.readSync(STDIN, buffer, 0, CHUNK_SIZE, null);
        return read === 0 ? null : buffer.subarray(0, read);
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === 'EOF') return null;
        if (code !== 'EAGAIN') throw error;
        Atomics.wait(pause, 0, 0, 10); // entrée non bloquante : on patiente un peu
      }
    }
  };

  const decode = (bytes: Buffer): string => bytes.toString('utf8').replace(/\r$/, '');

  const readLine = (): string | null => {
    for (;;) {
      const newline = pending.indexOf(NEWLINE);
      if (newline !== -1) {
        const line = pending.subarray(0, newline);
        pending = pending.subarray(newline + 1);
        return decode(line);
      }
      const chunk = ended ? null : readChunk();
      if (chunk === null) {
        ended = true;
        const rest = pending;
        pending = Buffer.alloc(0);
        return rest.length === 0 ? null : decode(rest);
      }
      pending = Buffer.concat([pending, chunk]);
    }
  };

  return {
    write: (text: string): void => {
      process.stdout.write(text);
    },
    readLine,
    random: Math.random,
  };
}
