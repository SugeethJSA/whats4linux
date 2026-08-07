import { useEffect, useState } from "react"
import {
  GetPrivacySettings,
  SetPrivacySetting,
  GetStatusPrivacy,
  SetStatusPrivacy,
  SetDisappearingTimerDefault,
} from "../../../wailsjs/go/api/Api"
import {
  RowList,
  SettingRow,
  SelectMenu,
  SettingsCard,
} from "../../components/settings/ui-kit"
import { useT } from "../../lib/i18n"

interface Setting {
  key: string
  labelKey: string
  descKey: string
  options: { value: string; labelKey: string }[]
}

const SETTINGS: Setting[] = [
  {
    key: "last",
    labelKey: "settings.privacy.last",
    descKey: "settings.privacy.last.desc",
    options: [
      { value: "all", labelKey: "settings.privacy.opt.everyone" },
      { value: "contacts", labelKey: "settings.privacy.opt.contacts" },
      { value: "contact_blacklist", labelKey: "settings.privacy.opt.contactsExcept" },
      { value: "none", labelKey: "settings.privacy.opt.nobody" },
      { value: "match_last_seen", labelKey: "settings.privacy.opt.sameAsLastSeen" },
    ],
  },
  {
    key: "profile",
    labelKey: "settings.privacy.profile",
    descKey: "settings.privacy.profile.desc",
    options: [
      { value: "all", labelKey: "settings.privacy.opt.everyone" },
      { value: "contacts", labelKey: "settings.privacy.opt.contacts" },
      { value: "contact_blacklist", labelKey: "settings.privacy.opt.contactsExcept" },
      { value: "none", labelKey: "settings.privacy.opt.nobody" },
    ],
  },
  {
    key: "status",
    labelKey: "settings.privacy.about",
    descKey: "settings.privacy.about.desc",
    options: [
      { value: "all", labelKey: "settings.privacy.opt.everyone" },
      { value: "contacts", labelKey: "settings.privacy.opt.contacts" },
      { value: "contact_blacklist", labelKey: "settings.privacy.opt.contactsExcept" },
      { value: "none", labelKey: "settings.privacy.opt.nobody" },
    ],
  },
  {
    key: "groupadd",
    labelKey: "settings.privacy.groups",
    descKey: "settings.privacy.groups.desc",
    options: [
      { value: "all", labelKey: "settings.privacy.opt.everyone" },
      { value: "contacts", labelKey: "settings.privacy.opt.contacts" },
      { value: "contact_blacklist", labelKey: "settings.privacy.opt.contactsExcept" },
    ],
  },
  {
    key: "readreceipts",
    labelKey: "settings.privacy.readReceipts",
    descKey: "settings.privacy.readReceipts.desc",
    options: [
      { value: "all", labelKey: "settings.privacy.opt.everyone" },
      { value: "none", labelKey: "settings.privacy.opt.nobody" },
    ],
  },
  {
    key: "online",
    labelKey: "settings.privacy.online",
    descKey: "settings.privacy.online.desc",
    options: [
      { value: "all", labelKey: "settings.privacy.opt.everyone" },
      { value: "contacts", labelKey: "settings.privacy.opt.contacts" },
      { value: "contact_blacklist", labelKey: "settings.privacy.opt.contactsExcept" },
      { value: "none", labelKey: "settings.privacy.opt.matchLastSeen" },
    ],
  },
  {
    key: "calladd",
    labelKey: "settings.privacy.calls",
    descKey: "settings.privacy.calls.desc",
    options: [
      { value: "all", labelKey: "settings.privacy.opt.everyone" },
      { value: "contacts", labelKey: "settings.privacy.opt.contacts" },
      { value: "contact_blacklist", labelKey: "settings.privacy.opt.contactsExcept" },
      { value: "none", labelKey: "settings.privacy.opt.nobody" },
    ],
  },
]

const TIMER_OPTIONS = [
  { value: "0", labelKey: "settings.privacy.timer.off" },
  { value: "86400", labelKey: "settings.privacy.timer.24h" },
  { value: "604800", labelKey: "settings.privacy.timer.7d" },
  { value: "7776000", labelKey: "settings.privacy.timer.90d" },
]

const PrivacySettingsScreen = () => {
  const t = useT()
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [statusBlacklist, setStatusBlacklist] = useState<string[]>([])
  const [defaultTimer, setDefaultTimer] = useState(0)
  const [timerBusy, setTimerBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    GetPrivacySettings()
      .then(res => {
        if (cancelled) return
        setValues({
          last: res.last_seen,
          profile: res.profile,
          status: res.status,
          groupadd: res.group_add,
          readreceipts: res.read_receipts,
          online: res.online,
          calladd: res.call_add,
        })
      })
      .catch(err => {
        console.error("Failed to load privacy settings:", err)
        setError(t("settings.privacy.loadError"))
      })
      .finally(() => !cancelled && setLoading(false))

    GetStatusPrivacy()
      .then(entries => {
        if (cancelled) return
        for (const e of entries) {
          if (e.type === "contact_blacklist") {
            setStatusBlacklist(e.jids || [])
          }
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = async (key: string, value: string) => {
    setBusy(key)
    setError("")
    try {
      if (key === "status") {
        await SetStatusPrivacy(value)
      } else {
        await SetPrivacySetting(key, value)
      }
      setValues(prev => ({ ...prev, [key]: value }))
    } catch (err) {
      console.error(`Failed to set ${key}:`, err)
      setError(t("settings.privacy.updateError", { key }))
    } finally {
      setBusy(null)
    }
  }

  const handleDefaultTimer = async (seconds: number) => {
    setTimerBusy(true)
    try {
      await SetDisappearingTimerDefault(seconds)
      setDefaultTimer(seconds)
    } catch (e) {
      console.error("Failed to set default disappearing timer:", e)
    } finally {
      setTimerBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[13px] text-light-muted dark:text-dark-muted">
        {t("settings.privacy.intro")}
      </p>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#21c063] border-t-transparent" />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-[13px] font-medium text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Default disappearing timer */}
      {!loading && (
        <SettingsCard>
          <SettingRow
            title={t("settings.privacy.timer")}
            description={t("settings.privacy.timer.desc")}
            control={
              <SelectMenu
                value={String(defaultTimer)}
                options={TIMER_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) }))}
                onChange={v => handleDefaultTimer(Number(v))}
                disabled={timerBusy}
              />
            }
          />
        </SettingsCard>
      )}

      {!loading && (
        <RowList>
          {SETTINGS.map(s => (
            <div key={s.key}>
              <SettingRow
                title={t(s.labelKey)}
                description={t(s.descKey)}
                control={
                  <SelectMenu
                    value={values[s.key] || ""}
                    options={s.options.map(o => ({ value: o.value, label: t(o.labelKey) }))}
                    onChange={v => handleChange(s.key, v)}
                    disabled={busy === s.key}
                  />
                }
              />
              {s.key === "status" &&
                values[s.key] === "contact_blacklist" &&
                statusBlacklist.length > 0 && (
                  <div className="px-4 pb-2.5 text-[12px] text-light-muted dark:text-dark-muted">
                    {t("settings.privacy.excluded", { list: statusBlacklist.join(", ") })}
                  </div>
                )}
            </div>
          ))}
        </RowList>
      )}
    </div>
  )
}

export default PrivacySettingsScreen
