import { useEffect, useState } from "react"
import { GetPrivacySettings, SetPrivacySetting } from "../../../wailsjs/go/api/Api"

type PrivacyValue = "all" | "contacts" | "contact_blacklist" | "none" | "match_last_seen" | "known"

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
    description: "Who can see when you read their messages. Read receipts are always sent for group chats.",
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

const selectCls =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none " +
  "focus:border-[#21c063] dark:border-white/10 dark:bg-dark-secondary " +
  "text-light-text dark:text-dark-text"

const PrivacySettingsScreen = () => {
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")

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
    return () => { cancelled = true }
  }, [])

  const handleChange = async (key: string, value: string) => {
    setBusy(key)
    setError("")
    try {
      await SetPrivacySetting(key, value)
      setValues(prev => ({ ...prev, [key]: value }))
    } catch (err) {
      console.error(`Failed to set ${key}:`, err)
      setError(`Failed to update ${key}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-light-text dark:text-dark-text">Privacy</h2>
      <p className="-mt-4 text-sm text-gray-500 dark:text-gray-400">
        Control who can see your personal information.
      </p>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#21c063] border-t-transparent" />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {!loading && SETTINGS.map(s => (
        <div key={s.key} className="flex items-center justify-between gap-4 rounded-lg border border-gray-100 bg-white p-4 dark:border-white/5 dark:bg-dark-secondary">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-light-text dark:text-dark-text">{s.label}</div>
            <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{s.description}</div>
          </div>
          <select
            value={values[s.key] || ""}
            onChange={e => handleChange(s.key, e.target.value)}
            disabled={busy === s.key}
            className={selectCls + (busy === s.key ? " opacity-50" : "")}
          >
            {s.options.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  )
}

export default PrivacySettingsScreen
