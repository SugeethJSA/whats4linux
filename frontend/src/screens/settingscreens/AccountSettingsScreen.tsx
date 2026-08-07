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
import { useT } from "../../lib/i18n"

const AccountSettingsScreen = ({ onNavigate }: { onNavigate?: (anchor: ReactNode) => void }) => {
  const t = useT()
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
      <SectionCard title={t("settings.account.status")} description={t("settings.account.status.desc")}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextField
            value={statusText}
            onChange={e => setStatusText(e.target.value)}
            placeholder={t("settings.account.status.placeholder")}
          />
          <ActionButton onClick={handleSaveStatus}>
            {statusSaved ? t("settings.account.saved") : t("settings.account.set")}
          </ActionButton>
        </div>
        {statusSaved && <StatusBanner tone="success">{t("settings.account.statusUpdated")}</StatusBanner>}
      </SectionCard>

      <SectionCard
        title={t("settings.account.pushName")}
        description={t("settings.account.pushName.desc")}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextField
            value={pushName}
            onChange={e => setPushNameState(e.target.value)}
            placeholder={t("settings.account.pushName.placeholder")}
          />
          <ActionButton onClick={handleSavePushName}>
            {pushNameSaved ? t("settings.account.saved") : t("settings.account.save")}
          </ActionButton>
        </div>
        {pushNameSaved && <StatusBanner tone="success">{t("settings.account.pushNameUpdated")}</StatusBanner>}
      </SectionCard>

      <SectionCard
        title={t("settings.account.qrLink")}
        description={t("settings.account.qrLink.desc")}
      >
        <ActionButton variant="primary" onClick={handleGetQRLink} disabled={qrBusy}>
          {qrBusy
            ? t("settings.account.loading")
            : qrLink
              ? t("settings.account.copied")
              : t("settings.account.getMyLink")}
        </ActionButton>
      </SectionCard>

      <SectionCard
        title={t("settings.account.resolveQr")}
        description={t("settings.account.resolveQr.desc")}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextField
            value={resolveCode}
            onChange={e => setResolveCode(e.target.value)}
            placeholder={t("settings.account.qrPlaceholder")}
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
                setResolveResult({ tone: "error", text: t("settings.account.resolveFailed") })
              } finally {
                setResolveBusy(false)
              }
            }}
          >
            {resolveBusy ? t("settings.account.resolving") : t("settings.account.resolve")}
          </ActionButton>
        </div>
        {resolveResult && <StatusBanner tone={resolveResult.tone}>{resolveResult.text}</StatusBanner>}
      </SectionCard>

      <SectionCard
        title={t("settings.account.resolveBiz")}
        description={t("settings.account.resolveBiz.desc")}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextField
            value={bizLinkCode}
            onChange={e => setBizLinkCode(e.target.value)}
            placeholder={t("settings.account.bizPlaceholder")}
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
                setBizLinkResult({ tone: "error", text: t("settings.account.bizFailed") })
              } finally {
                setBizLinkBusy(false)
              }
            }}
          >
            {bizLinkBusy ? t("settings.account.resolving") : t("settings.account.resolve")}
          </ActionButton>
        </div>
        {bizLinkResult && <StatusBanner tone={bizLinkResult.tone}>{bizLinkResult.text}</StatusBanner>}
      </SectionCard>

      <RowList>
        <LinkRow
          title={t("settings.account.deleteAccount")}
          description={t("settings.account.deleteAccount.desc")}
          href="https://faq.whatsapp.com/2138577903196467/?cms_platform=android&lang=en"
        />
        <LinkRow
          title={t("settings.account.securityNotifications")}
          description={t("settings.account.securityNotifications.desc")}
          onClick={() =>
            onNavigate?.(
              <div>
                <h2 className="mb-2 text-xl font-semibold tracking-tight text-light-text dark:text-dark-text">
                  {t("settings.account.securityNotifications.heading")}
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