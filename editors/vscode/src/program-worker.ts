import { parentPort, workerData } from 'node:worker_threads';
import { executeCompiled } from '../../../src/execute.ts';
import {
  END_OF_INPUT,
  HEADER_BYTES,
  MAILBOX_EMPTY,
  type ProgramData,
  type WorkerMessage,
} from './program-host.ts';

/** Thread d'exécution d'un programme Mojito (voir program-host.ts). */

const port = parentPort;
if (port === null) {
  throw new Error('program-worker doit être lancé comme worker');
}

const data = workerData as ProgramData;
const header = new Int32Array(data.buffer, 0, 2);
const bytes = new Uint8Array(data.buffer, HEADER_BYTES);
const decoder = new TextDecoder();
const send = (message: WorkerMessage): void => port.postMessage(message);

function readLine(): string | null {
  Atomics.store(header, 0, MAILBOX_EMPTY);
  send({ type: 'input' });
  Atomics.wait(header, 0, MAILBOX_EMPTY);
  const length = Atomics.load(header, 1);
  return length === END_OF_INPUT ? null : decoder.decode(bytes.slice(0, length));
}

const result = executeCompiled(data.js, {
  io: { write: (text) => send({ type: 'output', text }), readLine, random: Math.random },
  numberStyle: data.numberStyle,
});

send({
  type: 'done',
  errors: result.ok
    ? []
    : result.errors.map(({ kind, message, line, col, width }) => ({ kind, message, line, col, width })),
});
