import { useState, useEffect } from "react"
import { SecurityNotificationsScreen } from "./account/SecurityNotificationsScreen"
import {
  SetStatusMessage,
  GetContactQRLink,
  SetPushName,
  ResolveContactQRLink,
  ResolveBusinessMessageLink,
} from "../../../wailsjs/go/api/Api"
import type { ReactNode } from "react"
import {
  TextField,
  ActionButton,
  StatusBanner,
  SectionCard,
  RowList,
  LinkRow,
} from "../../components/settings/ui-kit"

const AccountSettingsScreen = ({ onNavigate }: { onNavigate?: (anchor: ReactNode) => void }) => {
  const [statusText, setStatusText] = useState("")
  const [statusSaved, setStatusSaved] = useState(false)
  const [qrLink, setQrLink] = useState("")
  const [qrBusy, setQrBusy] = useState(false)
  const [pushName, setPushNameState] = useState("")
  const [pushNameSaved, setPushNameSaved] = useState(false)
  const [resolveCode, setResolveCode] = useState("")
  const [resolveResult, setResolveResult] = useState<{ tone: "success" | "error"; text: string } | null>(null)
  const [resolveBusy, setResolveBusy] = useState(false)
  const [bizLinkCode, setBizLinkCode] = useState("")
  const [bizLinkResult, setBizLinkResult] = useState<{ tone: "success" | "error"; text: string } | null>(null)
  const [bizLinkBusy, setBizLinkBusy] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setStatusSaved(false), 2000)
    return () => clearTimeout(t)
  }, [statusSaved])

  useEffect(() => {
    const t = setTimeout(() => setPushNameSaved(false), 2000)
    return () => clearTimeout(t)
  }, [pushNameSaved])

  const handleSaveStatus = async () => {
    try {
      await SetStatusMessage(statusText)
      setStatusSaved(true)
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
    } catch (err) {
      console.error("Failed to set push name:", err)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionCard title="Status" description="Set your profile status message">
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextField
            value={statusText}
            onChange={e => setStatusText(e.target.value)}
            placeholder="What's your status?"
          />
          <ActionButton onClick={handleSaveStatus}>
            {statusSaved ? "Saved" : "Set"}
          </ActionButton>
        </div>
        {statusSaved && <StatusBanner tone="success">Status updated</StatusBanner>}
      </SectionCard>

      <SectionCard
        title="Push name"
        description="Name shown to others before they add you"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextField
            value={pushName}
            onChange={e => setPushNameState(e.target.value)}
            placeholder="Your push name"
          />
          <ActionButton onClick={handleSavePushName}>
            {pushNameSaved ? "Saved" : "Save"}
          </ActionButton>
        </div>
        {pushNameSaved && <StatusBanner tone="success">Push name updated</StatusBanner>}
      </SectionCard>

      <SectionCard
        title="Contact QR link"
        description="Share your contact link so others can add you on WhatsApp"
      >
        <ActionButton variant="primary" onClick={handleGetQRLink} disabled={qrBusy}>
          {qrBusy ? "Loading…" : qrLink ? "Copied to clipboard!" : "Get my contact link"}
        </ActionButton>
      </SectionCard>

      <SectionCard
        title="Resolve contact QR"
        description="Scan or paste a WhatsApp contact QR code link"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextField
            value={resolveCode}
            onChange={e => setResolveCode(e.target.value)}
            placeholder="https://wa.me/qr/..."
          />
          <ActionButton
            disabled={resolveBusy || !resolveCode.trim()}
            onClick={async () => {
              setResolveBusy(true)
              setResolveResult(null)
              try {
                const result = await ResolveContactQRLink(resolveCode.trim())
                setResolveResult({
                  tone: "success",
                  text: `JID: ${result.jid}${result.push_name ? ` · ${result.push_name}` : ""}`,
                })
              } catch {
                setResolveResult({ tone: "error", text: "Failed to resolve QR code" })
              } finally {
                setResolveBusy(false)
              }
            }}
          >
            {resolveBusy ? "Resolving…" : "Resolve"}
          </ActionButton>
        </div>
        {resolveResult && <StatusBanner tone={resolveResult.tone}>{resolveResult.text}</StatusBanner>}
      </SectionCard>

      <SectionCard
        title="Resolve business message link"
        description="Paste a business message link to resolve the business info"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextField
            value={bizLinkCode}
            onChange={e => setBizLinkCode(e.target.value)}
            placeholder="https://wa.me/message/..."
          />
          <ActionButton
            disabled={bizLinkBusy || !bizLinkCode.trim()}
            onClick={async () => {
              setBizLinkBusy(true)
              setBizLinkResult(null)
              try {
                const result = await ResolveBusinessMessageLink(bizLinkCode.trim())
                setBizLinkResult({
                  tone: "success",
                  text: `JID: ${result.jid}${result.push_name ? ` · ${result.push_name}` : ""}${result.verified_name ? ` ✓ ${result.verified_name}` : ""}`,
                })
              } catch {
                setBizLinkResult({ tone: "error", text: "Failed to resolve link" })
              } finally {
                setBizLinkBusy(false)
              }
            }}
          >
            {bizLinkBusy ? "Resolving…" : "Resolve"}
          </ActionButton>
        </div>
        {bizLinkResult && <StatusBanner tone={bizLinkResult.tone}>{bizLinkResult.text}</StatusBanner>}
      </SectionCard>

      <RowList>
        <LinkRow
          title="How to delete my account"
          description="Learn how to permanently delete your WhatsApp account"
          href="https://faq.whatsapp.com/2138577903196467/?cms_platform=android&lang=en"
        />
        <LinkRow
          title="Security notifications"
          description="Learn about end-to-end encryption and security alerts"
          onClick={() =>
            onNavigate?.(
              <div>
                <h2 className="mb-2 text-xl font-semibold tracking-tight text-light-text dark:text-dark-text">
                  Security Notifications
                </h2>
                <SecurityNotificationsScreen />
              </div>,
            )
          }
        />
      </RowList>
    </div>
  )
}

export default AccountSettingsScreen