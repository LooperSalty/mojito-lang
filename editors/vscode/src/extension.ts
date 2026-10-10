import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import * as vscode from 'vscode';
import { compile } from '../../../src/compiler.ts';
import { compiledOutputPath } from '../../../src/files.ts';
import { buildStandalone, isStandaloneOutput } from '../../../src/standalone.ts';
import { hoverAt, isEditableScheme, NEW_PROGRAM, problemsFor, type LineRange } from './core.ts';
import { createSession } from './session.ts';

/** Extension VS Code de Mojito : erreurs en direct, survol, exécution et compilation des fichiers .emoji. */

const LANGUAGE = 'mojito';
const JS_SCHEME = 'mojito-js';
const REFRESH_DELAY_MS = 250;
const TERMINAL_NAME = '🍹 Mojito';

interface State {
  readonly context: vscode.ExtensionContext;
  readonly diagnostics: vscode.DiagnosticCollection;
  readonly timers: Map<string, ReturnType<typeof setTimeout>>;
  readonly jsChanged: vscode.EventEmitter<vscode.Uri>;
  terminal: vscode.Terminal | undefined;
}

const isMojito = (document: vscode.TextDocument): boolean =>
  document.languageId === LANGUAGE && isEditableScheme(document.uri.scheme);

const toRange = (range: LineRange): vscode.Range => new vscode.Range(range.line, range.start, range.line, range.end);

const asciiNumbers = (): boolean => vscode.workspace.getConfiguration('mojito').get<boolean>('asciiNumbers', false);

function refresh(state: State, document: vscode.TextDocument): void {
  if (!isMojito(document) || document.isClosed) {
    return;
  }
  const problems = problemsFor(document.getText()).map((problem) => {
    const diagnostic = new vscode.Diagnostic(toRange(problem.range), problem.message, vscode.DiagnosticSeverity.Error);
    diagnostic.source = `Mojito (${problem.kind})`;
    return diagnostic;
  });
  state.diagnostics.set(document.uri, problems);
}

function onChange(state: State, document: vscode.TextDocument): void {
  if (!isMojito(document)) {
    return;
  }
  const key = document.uri.toString();
  clearTimeout(state.timers.get(key));
  state.timers.set(key, setTimeout(() => {
    state.timers.delete(key);
    refresh(state, document);
    state.jsChanged.fire(jsUri(document));
  }, REFRESH_DELAY_MS));
}

function onClose(state: State, document: vscode.TextDocument): void {
  const key = document.uri.toString();
  clearTimeout(state.timers.get(key));
  state.timers.delete(key);
  state.diagnostics.delete(document.uri);
}

/** Document visé : celui du clic droit ou du bouton, sinon l'éditeur actif. */
async function targetDocument(uri: unknown): Promise<vscode.TextDocument | undefined> {
  const document = uri instanceof vscode.Uri
    ? await vscode.workspace.openTextDocument(uri)
    : vscode.window.activeTextEditor?.document;
  if (document === undefined || !isMojito(document)) {
    void vscode.window.showWarningMessage('Ouvre un fichier .emoji pour utiliser cette commande Mojito.');
    return undefined;
  }
  return document;
}

async function runFile(state: State, uri: unknown): Promise<void> {
  const document = await targetDocument(uri);
  if (document === undefined) {
    return;
  }
  const writer = new vscode.EventEmitter<string>();
  const session = createSession({
    workerPath: state.context.asAbsolutePath('dist/program-worker.js'),
    source: document.getText(),
    fileName: document.isUntitled ? 'programme.emoji' : basename(document.uri.fsPath),
    numberStyle: asciiNumbers() ? 'ascii' : 'emoji',
    write: (text) => writer.fire(text),
  });
  const pty: vscode.Pseudoterminal = {
    onDidWrite: writer.event,
    open: session.open,
    close: () => {
      session.close();
      writer.dispose();
    },
    handleInput: session.handleInput,
  };
  state.terminal?.dispose();
  state.terminal = vscode.window.createTerminal({ name: TERMINAL_NAME, pty });
  // Si le programme lit des entrées 🎤, le terminal prend le focus pour qu'on puisse taper.
  state.terminal.show(!document.getText().includes('🎤'));
}

async function confirmOverwrite(output: string): Promise<boolean> {
  if (!existsSync(output) || isStandaloneOutput(readFileSync(output, 'utf8'))) {
    return true;
  }
  const choice = await vscode.window.showWarningMessage(
    `${basename(output)} existe déjà et n'a pas été produit par Mojito. Le remplacer ?`,
    { modal: true },
    'Remplacer',
  );
  return choice === 'Remplacer';
}

async function buildFile(uri: unknown): Promise<void> {
  const document = await targetDocument(uri);
  if (document === undefined) {
    return;
  }
  if (document.uri.scheme !== 'file' || (document.isDirty && !(await document.save()))) {
    void vscode.window.showWarningMessage('Enregistre d’abord ce programme dans un fichier .emoji.');
    return;
  }
  const result = compile(document.getText());
  if (!result.ok) {
    void vscode.window.showErrorMessage(`Mojito : ${result.errors.length} erreur(s) à corriger avant de compiler (voir l’onglet Problèmes).`);
    return;
  }
  const output = compiledOutputPath(document.uri.fsPath);
  if (!(await confirmOverwrite(output))) {
    return;
  }
  try {
    writeFileSync(output, buildStandalone(result.js, asciiNumbers() ? 'ascii' : 'emoji'), 'utf8');
  } catch (error) {
    void vscode.window.showErrorMessage(`Mojito : impossible d’écrire ${basename(output)} (${(error as Error).message}).`);
    return;
  }
  const choice = await vscode.window.showInformationMessage(`📦 ${basename(output)} créé — lance-le avec : node ${basename(output)}`, 'Ouvrir');
  if (choice === 'Ouvrir') {
    await vscode.window.showTextDocument(vscode.Uri.file(output));
  }
}

/** Vue JavaScript en lecture seule, liée au fichier .emoji d'origine. */
function jsUri(document: vscode.TextDocument): vscode.Uri {
  const name = document.isUntitled ? 'programme' : basename(document.uri.fsPath);
  return vscode.Uri.from({ scheme: JS_SCHEME, path: `/${name}.js`, query: document.uri.toString() });
}

function provideJavaScript(uri: vscode.Uri): string {
  const source = vscode.workspace.textDocuments.find((document) => document.uri.toString() === uri.query);
  if (source === undefined) {
    return '// Le fichier .emoji d’origine est fermé.\n';
  }
  const result = compile(source.getText());
  return result.ok ? result.js : `// ${result.errors.length} erreur(s) Mojito : corrige-les pour voir le JavaScript généré.\n`;
}

async function showJavaScript(uri: unknown): Promise<void> {
  const document = await targetDocument(uri);
  if (document !== undefined) {
    const js = await vscode.workspace.openTextDocument(jsUri(document));
    await vscode.window.showTextDocument(js, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true });
  }
}

async function newProgram(): Promise<void> {
  const document = await vscode.workspace.openTextDocument({ language: LANGUAGE, content: NEW_PROGRAM });
  await vscode.window.showTextDocument(document);
}

function registerCommands(state: State): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('mojito.run', (uri: unknown) => runFile(state, uri)),
    vscode.commands.registerCommand('mojito.build', (uri: unknown) => buildFile(uri)),
    vscode.commands.registerCommand('mojito.showJs', (uri: unknown) => showJavaScript(uri)),
    vscode.commands.registerCommand('mojito.newFile', () => newProgram()),
  ];
}

export function activate(context: vscode.ExtensionContext): void {
  const state: State = {
    context,
    diagnostics: vscode.languages.createDiagnosticCollection(LANGUAGE),
    timers: new Map(),
    jsChanged: new vscode.EventEmitter<vscode.Uri>(),
    terminal: undefined,
  };
  context.subscriptions.push(
    state.diagnostics,
    state.jsChanged,
    vscode.workspace.onDidOpenTextDocument((document) => refresh(state, document)),
    vscode.workspace.onDidChangeTextDocument((event) => onChange(state, event.document)),
    vscode.workspace.onDidCloseTextDocument((document) => onClose(state, document)),
    vscode.window.onDidCloseTerminal((terminal) => {
      if (terminal === state.terminal) state.terminal = undefined;
    }),
    vscode.workspace.registerTextDocumentContentProvider(JS_SCHEME, {
      onDidChange: state.jsChanged.event,
      provideTextDocumentContent: provideJavaScript,
    }),
    vscode.languages.registerHoverProvider(LANGUAGE, {
      provideHover(document, position) {
        const info = hoverAt(document.getText(), position.line, position.character);
        return info === null ? undefined : new vscode.Hover(new vscode.MarkdownString(info.markdown), toRange(info.range));
      },
    }),
    ...registerCommands(state),
    { dispose: () => state.timers.forEach((timer) => clearTimeout(timer)) },
  );
  vscode.workspace.textDocuments.forEach((document) => refresh(state, document));
}

export function deactivate(): void {
  // Tout est libéré via context.subscriptions.
}
