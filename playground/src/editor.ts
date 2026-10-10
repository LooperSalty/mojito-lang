/** Petites aides pour la zone de code (textarea + gouttière de numéros de ligne). */

export function insertAtCursor(textarea: HTMLTextAreaElement, text: string): void {
  const { selectionStart, selectionEnd, value } = textarea;
  const before = value.slice(0, selectionStart);
  const needsSpace = before.length > 0 && !/\s$/.test(before);
  const insertion = `${needsSpace ? ' ' : ''}${text} `;
  textarea.focus();
  textarea.setRangeText(insertion, selectionStart, selectionEnd, 'end');
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

export function renderGutter(gutter: HTMLElement, source: string, errorLines: ReadonlySet<number>): void {
  const count = source.split('\n').length;
  const fragment = document.createDocumentFragment();
  for (let line = 1; line <= count; line += 1) {
    const cell = document.createElement('span');
    cell.textContent = String(line);
    if (errorLines.has(line)) {
      cell.className = 'has-error';
    }
    fragment.append(cell);
  }
  gutter.replaceChildren(fragment);
}

/** Tabulation = deux espaces ; Ctrl/Cmd + Entrée = exécuter. */
export function bindEditorKeys(textarea: HTMLTextAreaElement, onRun: () => void): void {
  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      onRun();
    } else if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      textarea.setRangeText('  ', textarea.selectionStart, textarea.selectionEnd, 'end');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
}

export function loadDraft(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function saveDraft(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Stockage indisponible (navigation privée…) : le brouillon n'est simplement pas gardé.
  }
}
