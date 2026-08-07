import { useState } from "react"
import { Logout } from "../../../wailsjs/go/api/Api"
import { ActionButton, SettingsCard } from "../../components/settings/ui-kit"
import { useT } from "../../lib/i18n"

const LogOut = () => {
  const t = useT()
  const [busy, setBusy] = useState(false)

  const handleLogout = async () => {
    if (!confirm(t("settings.logout.confirm"))) return
    setBusy(true)
    try {
      await Logout()
    } catch (err) {
      console.error("Logout failed:", err)
      alert(t("settings.logout.failed", { error: String(err) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto mt-4 max-w-xl">
      <SettingsCard className="p-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
            <path d="M16 13v-2H7V8l-5 4 5 4v-3z" />
            <path d="M20 3h-9c-1.103 0-2 .897-2 2v4h2V5h9v14h-9v-4H9v4c0 1.103.897 2 2 2h9c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2z" />
          </svg>
        </div>
        <h2 className="mt-4 text-xl font-bold tracking-tight text-light-text dark:text-dark-text">
          {t("settings.logout.title")}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-light-muted dark:text-dark-muted">
          {t("settings.logout.description")}
        </p>
        <ActionButton variant="danger" onClick={handleLogout} disabled={busy} className="mt-5">
          {busy ? t("settings.logout.busy") : t("settings.logout.button")}
        </ActionButton>
      </SettingsCard>
    </div>
  )
}

export default LogOut