import { useEffect } from "react"
import { runShortcut } from "../lib/shortcuts"
import { SHORTCUT_DEFS, openChatRangeDefs } from "../lib/shortcutDefs"

// Matches by e.code so it survives keyboard layouts (the "/" in Ctrl+Alt+/
// is ambiguous across layouts, bracket keys likewise). The exact modifier
// combination must match, so e.g. Ctrl+Alt+P and Ctrl+Shift+P stay distinct.
const ALL_DEFS = [
  ...SHORTCUT_DEFS.filter(d => !d.unsupported && !d.openChatRange),
  ...openChatRangeDefs(),
]

/**
 * Global keydown listener for the whole app. It dispatches shortcuts to
 * whatever registered the handler and never fires while the user is typing in
 * an editable field.
 */
export function useGlobalShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey) return

      const target = e.target as HTMLElement | null
      if (target && target.isContentEditable) return
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")
      ) {
        return
      }

      for (const def of ALL_DEFS) {
        if (e.code !== def.code) continue
        if (!!e.ctrlKey !== !!def.mods.ctrl) continue
        if (!!e.altKey !== !!def.mods.alt) continue
        if (!!e.shiftKey !== !!def.mods.shift) continue
        if (runShortcut(def.name)) e.preventDefault()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
}