import { useState, useEffect } from "react"
import SimpleIconTitle from "../../components/settings/SimpleIconTitle"
import SecurityNotificationsScreen from "./account/SecurityNotificationsScreen"
import { SetStatusMessage, GetContactQRLink, SetPushName, ResolveContactQRLink } from "../../../wailsjs/go/api/Api"
import type { ReactNode } from "react"

const AccountSettingsScreen = ({ onNavigate }: { onNavigate?: (anchor: ReactNode) => void }) => {
  const [statusText, setStatusText] = useState("")
  const [statusSaved, setStatusSaved] = useState(false)
  const [qrLink, setQrLink] = useState("")
  const [qrBusy, setQrBusy] = useState(false)
  const [pushName, setPushNameState] = useState("")
  const [pushNameSaved, setPushNameSaved] = useState(false)
  const [resolveCode, setResolveCode] = useState("")
  const [resolveResult, setResolveResult] = useState<string | null>(null)
  const [resolveBusy, setResolveBusy] = useState(false)

  const handleSaveStatus = async () => {
    try {
      await SetStatusMessage(statusText)
      setStatusSaved(true)
      setTimeout(() => setStatusSaved(false), 2000)
    } catch (err) {
      console.error("Failed to set status:", err)
    }
  }

  const handleGetQRLink = async () => {
    setQrBusy(true)
    try {
      const link = await GetContactQRLink(false)
      setQrLink(link)
      navigator.clipboard.writeText(link)
    } catch (err) {
      console.error("Failed to get QR link:", err)
    } finally {
      setQrBusy(false)
    }
  }

  const handleSavePushName = async () => {
    try {
      await SetPushName(pushName)
      setPushNameSaved(true)
      setTimeout(() => setPushNameSaved(false), 2000)
    } catch (err) {
      console.error("Failed to set push name:", err)
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-3/4">
      {/* Status message */}
      <div className="rounded-xl border border-gray-200 dark:border-dark-border p-4">
        <h3 className="text-base font-medium text-light-text dark:text-dark-text mb-2">Status</h3>
        <p className="text-sm text-gray-500 dark:text-dark-muted mb-2">Set your profile status message</p>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-gray-300 dark:border-dark-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[#21c063] text-light-text dark:text-dark-text"
            value={statusText}
            onChange={e => setStatusText(e.target.value)}
            placeholder="What's your status?"
          />
          <button
            onClick={handleSaveStatus}
            className="rounded-lg bg-[#21c063] px-4 py-2 text-sm font-medium text-[#0a1014] hover:bg-[#1ea952]"
          >
            {statusSaved ? "Saved ✓" : "Set"}
          </button>
        </div>
      </div>

      {/* Push name */}
      <div className="rounded-xl border border-gray-200 dark:border-dark-border p-4">
        <h3 className="text-base font-medium text-light-text dark:text-dark-text mb-2">Push Name</h3>
        <p className="text-sm text-gray-500 dark:text-dark-muted mb-2">Name shown to others before they add you</p>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-gray-300 dark:border-dark-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[#21c063] text-light-text dark:text-dark-text"
            value={pushName}
            onChange={e => setPushNameState(e.target.value)}
            placeholder="Your push name"
          />
          <button
            onClick={handleSavePushName}
            className="rounded-lg bg-[#21c063] px-4 py-2 text-sm font-medium text-[#0a1014] hover:bg-[#1ea952]"
          >
            {pushNameSaved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>

      {/* Contact QR link */}
      <div className="rounded-xl border border-gray-200 dark:border-dark-border p-4">
        <h3 className="text-base font-medium text-light-text dark:text-dark-text mb-2">Contact QR Link</h3>
        <p className="text-sm text-gray-500 dark:text-dark-muted mb-2">Share your contact link so others can add you on WhatsApp</p>
        <button
          onClick={handleGetQRLink}
          disabled={qrBusy}
          className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {qrBusy ? "Loading…" : qrLink ? "Copied to clipboard!" : "Get My Contact Link"}
        </button>
      </div>

      {/* Resolve contact QR code */}
      <div className="rounded-xl border border-gray-200 dark:border-dark-border p-4">
        <h3 className="text-base font-medium text-light-text dark:text-dark-text mb-2">Resolve Contact QR</h3>
        <p className="text-sm text-gray-500 dark:text-dark-muted mb-2">Scan or paste a WhatsApp contact QR code link</p>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-gray-300 dark:border-dark-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[#21c063] text-light-text dark:text-dark-text"
            value={resolveCode}
            onChange={e => setResolveCode(e.target.value)}
            placeholder="https://wa.me/qr/..."
          />
          <button
            onClick={async () => {
              setResolveBusy(true)
              setResolveResult(null)
              try {
                const result = await ResolveContactQRLink(resolveCode.trim())
                setResolveResult(`JID: ${result.jid}${result.push_name ? ` · ${result.push_name}` : ""}`)
              } catch (err) {
                setResolveResult("Failed to resolve QR code")
              } finally {
                setResolveBusy(false)
              }
            }}
            disabled={resolveBusy || !resolveCode.trim()}
            className="rounded-lg bg-[#21c063] px-4 py-2 text-sm font-medium text-[#0a1014] hover:bg-[#1ea952] disabled:opacity-50"
          >
            {resolveBusy ? "Resolving…" : "Resolve"}
          </button>
        </div>
        {resolveResult && (
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{resolveResult}</p>
        )}
      </div>

      <SimpleIconTitle
        title="How to Delete my account"
        icon="⚙️"
        link="https://faq.whatsapp.com/2138577903196467/?cms_platform=android&lang=en"
      />
      <SimpleIconTitle
        title="Security Notifications"
        icon="⚙️"
        anchor={<SecurityNotificationsScreen />}
        onNavigate={onNavigate}
      />
    </div>
  )
}

export default AccountSettingsScreen
