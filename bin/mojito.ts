#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { main } from '../src/cli/main.ts';
import { createNodeIO } from '../src/runtime/node-io.ts';

process.exitCode = main(process.argv.slice(2), {
  readFile: (path) => readFileSync(path, 'utf8'),
  writeFile: (path, content) => writeFileSync(path, content, 'utf8'),
  stdout: (text) => {
    process.stdout.write(text);
  },
  stderr: (text) => {
    process.stderr.write(text);
  },
  io: createNodeIO(),
});
