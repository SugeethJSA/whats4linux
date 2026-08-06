/**
 * Tiny module-level registry for global keyboard shortcuts.
 *
 * Components register named action handlers while they're mounted (and only
 * while they are the active context, e.g. the chat list only registers while
 * the "chats" screen is visible). The global keydown listener in
 * useGlobalShortcuts() maps key combinations to names and runs the handler.
 */

export type ShortcutHandler = () => void

const handlers = new Map<string, ShortcutHandler>()

export function registerShortcut(name: string, handler: ShortcutHandler): () => void {
  handlers.set(name, handler)
  return () => {
    if (handlers.get(name) === handler) handlers.delete(name)
  }
}

export function runShortcut(name: string): boolean {
  const fn = handlers.get(name)
  if (!fn) return false
  fn()
  return true
}
