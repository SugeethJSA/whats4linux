import { RowList } from "../../components/settings/ui-kit"
import { useT } from "../../lib/i18n"
import { SHORTCUT_DEFS, SHORTCUT_CATEGORY_KEYS, shortcutCaps, type ShortcutDef } from "../../lib/shortcutDefs"

const supportedShortcuts = SHORTCUT_DEFS.filter(s => !s.unsupported)

function Keycap({ children }: { children: string }) {
  return (
    <span className="rounded-lg border border-black/[0.08] bg-light-secondary px-1.5 py-0.5 text-[11px] font-semibold text-light-text shadow-[0_1px_0_rgba(0,0,0,0.15)] dark:border-white/[0.1] dark:bg-dark-elevated dark:text-dark-text dark:shadow-none">
      {children}
    </span>
  )
}

/** Single row used in the settings preview builders. */
export const SingleShortcut = ({ name, shortcut }: { name: string; shortcut: string[] }) => {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-sm font-medium text-light-text dark:text-dark-text">{name}</div>
      <div className="flex items-center gap-1">
        {shortcut.map((key, index) => (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && <span className="text-[11px] text-light-muted dark:text-dark-muted">+</span>}
            <Keycap>{key}</Keycap>
          </span>
        ))}
      </div>
    </div>
  )
}

function ShortcutRow({ t, def }: { t: (key: string) => string; def: ShortcutDef }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
      <div className="min-w-0 truncate text-sm text-light-text dark:text-dark-text">{t(def.nameKey)}</div>
      <div className="flex shrink-0 items-center gap-1">
        {shortcutCaps(def).map((key, index) => (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && <span className="text-[11px] text-light-muted/80 dark:text-dark-muted/80">+</span>}
            <Keycap>{key}</Keycap>
          </span>
        ))}
      </div>
    </div>
  )
}

const KeyBoardShortCuts = () => {
  const t = useT()
  return (
    <div className="flex flex-col gap-6">
      {SHORTCUT_CATEGORY_KEYS.map(categoryKey => {
        const items = supportedShortcuts.filter(s => s.categoryKey === categoryKey)
        if (items.length === 0) return null
        return (
          <div key={categoryKey}>
            <div className="mb-1.5 px-1 text-[12px] font-semibold uppercase tracking-wide text-light-muted dark:text-dark-muted">
              {t(categoryKey)}
            </div>
            <RowList>
              {items.map((def, index) => (
                <ShortcutRow key={index} t={t} def={def} />
              ))}
            </RowList>
          </div>
        )
      })}
    </div>
  )
}

export default KeyBoardShortCuts