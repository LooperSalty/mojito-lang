import { Worker } from 'node:worker_threads';
import type { Diagnostic } from '../../../src/errors.ts';
import type { NumberStyle } from '../../../src/runtime/runtime.ts';

/**
 * Lance un programme Mojito compilé dans un thread séparé (worker).
 *
 * Le programme est synchrone : quand il lit une ligne avec 🎤, le worker se
 * met en pause (Atomics.wait) jusqu'à ce que l'hôte dépose la ligne dans une
 * mémoire partagée. L'éditeur, lui, n'est jamais bloqué.
 */

/** Taille maximale d'une ligne saisie, en octets UTF-8. */
export const INPUT_CAPACITY = 64 * 1024;
export const HEADER_BYTES = 8;
/** Case 0 : état de la boîte aux lettres ; case 1 : longueur de la ligne (-1 = fin des entrées). */
export const MAILBOX_EMPTY = 0;
export const MAILBOX_FULL = 1;
export const END_OF_INPUT = -1;

export interface ProgramData {
  readonly js: string;
  readonly numberStyle: NumberStyle;
  readonly buffer: SharedArrayBuffer;
}

export type WorkerMessage =
  | { readonly type: 'output'; readonly text: string }
  | { readonly type: 'input' }
  | { readonly type: 'done'; readonly errors: readonly Diagnostic[] };

export type ProgramOutcome =
  | { readonly kind: 'finished'; readonly errors: readonly Diagnostic[] }
  | { readonly kind: 'stopped' }
  | { readonly kind: 'crashed'; readonly message: string };

export interface ProgramCallbacks {
  readonly onOutput: (text: string) => void;
  readonly onInputRequest: () => void;
  readonly onExit: (outcome: ProgramOutcome) => void;
}

export interface RunningProgram {
  /** Répond à une demande d'entrée (null = fin des entrées, 🎤 renverra 🕳️). */
  readonly submit: (line: string | null) => void;
  readonly stop: () => void;
}

export function startProgram(
  workerPath: string,
  js: string,
  numberStyle: NumberStyle,
  callbacks: ProgramCallbacks,
): RunningProgram {
  const buffer = new SharedArrayBuffer(HEADER_BYTES + INPUT_CAPACITY);
  const header = new Int32Array(buffer, 0, 2);
  const bytes = new Uint8Array(buffer, HEADER_BYTES);
  const encoder = new TextEncoder();
  const data: ProgramData = { js, numberStyle, buffer };
  const worker = new Worker(workerPath, { workerData: data });
  let finished = false;

  const finish = (outcome: ProgramOutcome): void => {
    if (!finished) {
      finished = true;
      callbacks.onExit(outcome);
    }
  };

  worker.on('message', (message: WorkerMessage) => {
    if (message.type === 'output') callbacks.onOutput(message.text);
    else if (message.type === 'input') callbacks.onInputRequest();
    else finish({ kind: 'finished', errors: message.errors });
  });
  worker.on('error', (error: Error) => finish({ kind: 'crashed', message: error.message }));
  worker.on('exit', () => finish({ kind: 'crashed', message: "Le programme s'est arrêté sans prévenir." }));

  return {
    submit(line) {
      if (finished) return;
      const encoded = line === null ? null : encoder.encode(line).subarray(0, INPUT_CAPACITY);
      if (encoded !== null) bytes.set(encoded);
      Atomics.store(header, 1, encoded === null ? END_OF_INPUT : encoded.length);
      Atomics.store(header, 0, MAILBOX_FULL);
      Atomics.notify(header, 0);
    },
    stop() {
      finish({ kind: 'stopped' });
      void worker.terminate();
    },
  };
}
