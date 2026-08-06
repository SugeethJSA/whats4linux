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

interface Setting {
  key: string
  label: string
  description: string
  options: { value: string; label: string }[]
}

const SETTINGS: Setting[] = [
  {
    key: "last",
    label: "Last seen & online",
    description: "Who can see your last seen time and online status.",
    options: [
      { value: "all", label: "Everyone" },
      { value: "contacts", label: "My contacts" },
      { value: "contact_blacklist", label: "My contacts except…" },
      { value: "none", label: "Nobody" },
      { value: "match_last_seen", label: "Same as last seen" },
    ],
  },
  {
    key: "profile",
    label: "Profile photo",
    description: "Who can see your profile photo.",
    options: [
      { value: "all", label: "Everyone" },
      { value: "contacts", label: "My contacts" },
      { value: "contact_blacklist", label: "My contacts except…" },
      { value: "none", label: "Nobody" },
    ],
  },
  {
    key: "status",
    label: "About",
    description: "Who can see your about information.",
    options: [
      { value: "all", label: "Everyone" },
      { value: "contacts", label: "My contacts" },
      { value: "contact_blacklist", label: "My contacts except…" },
      { value: "none", label: "Nobody" },
    ],
  },
  {
    key: "groupadd",
    label: "Groups",
    description: "Who can add you to groups.",
    options: [
      { value: "all", label: "Everyone" },
      { value: "contacts", label: "My contacts" },
      { value: "contact_blacklist", label: "My contacts except…" },
    ],
  },
  {
    key: "readreceipts",
    label: "Read receipts",
    description:
      "Who can see when you read their messages. Read receipts are always sent for group chats.",
    options: [
      { value: "all", label: "Everyone" },
      { value: "none", label: "Nobody" },
    ],
  },
  {
    key: "online",
    label: "Online status",
    description: "Who can see when you are online.",
    options: [
      { value: "all", label: "Everyone" },
      { value: "contacts", label: "My contacts" },
      { value: "contact_blacklist", label: "My contacts except…" },
      { value: "none", label: "Match last seen" },
    ],
  },
  {
    key: "calladd",
    label: "Calls",
    description: "Who can call you.",
    options: [
      { value: "all", label: "Everyone" },
      { value: "contacts", label: "My contacts" },
      { value: "contact_blacklist", label: "My contacts except…" },
      { value: "none", label: "Nobody" },
    ],
  },
]

const TIMER_OPTIONS = [
  { value: "0", label: "Off" },
  { value: "86400", label: "24 hours" },
  { value: "604800", label: "7 days" },
  { value: "7776000", label: "90 days" },
]

const PrivacySettingsScreen = () => {
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
        setError("Failed to load privacy settings")
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
      setError(`Failed to update ${key}`)
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
        Control who can see your personal information.
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
            title="Default disappearing timer"
            description="Sets the default timer for new chats."
            control={
              <SelectMenu
                value={String(defaultTimer)}
                options={TIMER_OPTIONS}
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
                title={s.label}
                description={s.description}
                control={
                  <SelectMenu
                    value={values[s.key] || ""}
                    options={s.options}
                    onChange={v => handleChange(s.key, v)}
                    disabled={busy === s.key}
                  />
                }
              />
              {s.key === "status" &&
                values[s.key] === "contact_blacklist" &&
                statusBlacklist.length > 0 && (
                  <div className="px-4 pb-2.5 text-[12px] text-light-muted dark:text-dark-muted">
                    Excluded: {statusBlacklist.join(", ")}
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