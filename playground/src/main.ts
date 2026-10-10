import type { Engine } from '../../src/execute.ts';
import { bindEditorKeys, insertAtCursor, loadDraft, renderGutter, saveDraft } from './editor.ts';
import { DEFAULT_EXAMPLE, EXAMPLE_META } from './examples.ts';
import { renderPalette } from './palette.ts';
import { compile, detectEngine, runProgram, tokensTable } from './runner.ts';

/** Sources des exemples, injectées au build depuis le dossier examples/. */
declare const __EXAMPLES__: Readonly<Record<string, string>>;

const DRAFT_KEY = 'mojito-playground-brouillon';
const ENGINE_LABELS: Readonly<Record<Engine, string>> = {
  compiled: 'Moteur : JavaScript compilé',
  interpreter: "Moteur : interpréteur d'AST (cette page n'autorise pas l'évaluation de JavaScript)",
};

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (found === null) {
    throw new Error(`Élément #${id} introuvable`);
  }
  return found as T;
}

const ui = {
  code: element<HTMLTextAreaElement>('code'),
  gutter: element<HTMLElement>('gutter'),
  status: element<HTMLElement>('status'),
  example: element<HTMLSelectElement>('example'),
  ascii: element<HTMLInputElement>('ascii'),
  run: element<HTMLButtonElement>('run'),
  copy: element<HTMLButtonElement>('copy'),
  output: element<HTMLElement>('output'),
  js: element<HTMLElement>('js'),
  tokens: element<HTMLElement>('tokens'),
  stdin: element<HTMLTextAreaElement>('stdin'),
  hint: element<HTMLElement>('hint'),
  engine: element<HTMLElement>('engine'),
  palette: element<HTMLElement>('palette'),
  tabs: Array.from(document.querySelectorAll<HTMLButtonElement>('[data-tab]')),
};

const engine = detectEngine();
let refreshTimer = 0;

function refresh(): void {
  const source = ui.code.value;
  const compiled = compile(source);
  const errorLines = new Set(compiled.ok ? [] : compiled.errors.map((error) => error.line));
  renderGutter(ui.gutter, source, errorLines);
  ui.js.textContent = compiled.ok ? compiled.js : '// Corrige les erreurs pour voir le JavaScript généré.';
  ui.tokens.textContent = tokensTable(source);
  ui.status.textContent = compiled.ok
    ? '✅ compile'
    : `${compiled.errors.length} erreur${compiled.errors.length > 1 ? 's' : ''} · ligne ${compiled.errors[0]?.line ?? '?'}`;
  ui.status.dataset['state'] = compiled.ok ? 'ok' : 'error';
}

function execute(): void {
  const source = ui.code.value;
  const inputs = ui.stdin.value === '' ? [] : ui.stdin.value.split('\n');
  const report = runProgram(compile(source), source, inputs, ui.ascii.checked ? 'ascii' : 'emoji', engine);
  const nodes = report.chunks
    .filter((chunk) => chunk.text !== '')
    .map((chunk) => {
      const span = document.createElement('span');
      span.textContent = chunk.isError ? `${chunk.text}\n` : chunk.text;
      span.className = chunk.isError ? 'out-error' : 'out-text';
      return span;
    });
  ui.output.replaceChildren(...(nodes.length > 0 ? nodes : [document.createTextNode('(rien à afficher)')]));
  const duration = report.durationMs < 1 ? '< 1 ms' : `${Math.round(report.durationMs)} ms`;
  ui.engine.textContent = `${ENGINE_LABELS[report.engine]} · ${duration}`;
  selectTab('output');
}

function selectTab(name: string): void {
  for (const tab of ui.tabs) {
    const active = tab.dataset['tab'] === name;
    tab.setAttribute('aria-selected', String(active));
    element(tab.dataset['tab'] ?? '').hidden = !active;
  }
}

function loadExample(file: string): void {
  const meta = EXAMPLE_META.find((entry) => entry.file === file);
  ui.code.value = __EXAMPLES__[file] ?? '';
  ui.stdin.value = meta?.inputs ?? '';
  ui.example.value = file;
  saveDraft(DRAFT_KEY, ui.code.value);
  refresh();
  execute();
}

function populateExamples(): void {
  const options = EXAMPLE_META.filter((meta) => __EXAMPLES__[meta.file] !== undefined).map((meta) => {
    const option = document.createElement('option');
    option.value = meta.file;
    option.textContent = meta.label;
    return option;
  });
  ui.example.replaceChildren(...options);
}

async function copyCode(): Promise<void> {
  try {
    await navigator.clipboard.writeText(ui.code.value);
    ui.copy.textContent = 'Copié';
  } catch {
    ui.code.select();
    ui.copy.textContent = 'Sélectionné';
  }
  window.setTimeout(() => {
    ui.copy.textContent = 'Copier';
  }, 1500);
}

function start(): void {
  populateExamples();
  renderPalette(ui.palette, (key) => {
    insertAtCursor(ui.code, key.emoji);
    ui.hint.textContent = `${key.emoji} ${key.meaning}`;
  });
  bindEditorKeys(ui.code, execute);
  ui.code.addEventListener('input', () => {
    saveDraft(DRAFT_KEY, ui.code.value);
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refresh, 150);
  });
  ui.code.addEventListener('scroll', () => {
    ui.gutter.scrollTop = ui.code.scrollTop;
  });
  ui.example.addEventListener('change', () => loadExample(ui.example.value));
  ui.run.addEventListener('click', execute);
  ui.copy.addEventListener('click', () => void copyCode());
  ui.ascii.addEventListener('change', execute);
  ui.tabs.forEach((tab) => tab.addEventListener('click', () => selectTab(tab.dataset['tab'] ?? 'output')));

  const draft = loadDraft(DRAFT_KEY);
  if (draft !== null && draft.trim() !== '') {
    ui.code.value = draft;
    ui.example.value = '';
    refresh();
    execute();
  } else {
    loadExample(DEFAULT_EXAMPLE);
  }
}

start();
