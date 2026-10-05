// The welcome screen: shown on a first visit, and again on request (the About link or `?`).

/** The part of localStorage the welcome needs. */
export interface SeenStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'microglia-paper-game:welcomed';

/** True until the visitor has started once. A browser that refuses storage is welcomed every time. */
export function shouldWelcome(store: SeenStore): boolean {
  try { return store.getItem(KEY) === null; } catch { return true; }
}

export function markWelcomed(store: SeenStore): void {
  try { store.setItem(KEY, '1'); } catch { /* private mode: nothing to remember */ }
}

/** Wires the dialog: it opens on a first visit and closes on Start, Escape or a click outside. */
export function initWelcome(onClose: () => void): HTMLDialogElement {
  const dialog = document.getElementById('welcome') as HTMLDialogElement;
  const storage = (): SeenStore => window.localStorage;
  dialog.addEventListener('close', () => {
    try { markWelcomed(storage()); } catch { /* storage unavailable */ }
    onClose();
  });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  document.getElementById('welcome-start')!.addEventListener('click', () => dialog.close());
  document.getElementById('welcome-open')!.addEventListener('click', () => dialog.showModal());
  let first = true;
  try { first = shouldWelcome(storage()); } catch { /* storage unavailable: welcome anyway */ }
  if (first) dialog.showModal(); else onClose();
  return dialog;
}
