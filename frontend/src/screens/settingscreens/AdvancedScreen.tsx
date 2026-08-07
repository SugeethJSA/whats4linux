import { useState, useEffect } from "react"
import {
  GetCustomCSS,
  SetCustomCSS,
  GetCustomJS,
  SetCustomJS,
  Reinitialize,
  SetProxy,
  FetchStickerPack,
} from "../../../wailsjs/go/api/Api"

import ComponentColorSelector from "../../components/settings/ComponentColorSelector"
import EaseVisualizer from "../../components/settings/ComponentEaseSelector"
import {
  SettingsCard,
  TextField,
  ActionButton,
  StatusBanner,
} from "../../components/settings/ui-kit"
import { useT } from "../../lib/i18n"

function CodeEditorCard({
  title,
  description,
  value,
  onChange,
  onSave,
  placeholder,
  saved,
}: {
  title: string
  description: string
  value: string
  onChange: (v: string) => void
  onSave: () => void
  placeholder: string
  saved: boolean
}) {
  const t = useT()
  return (
    <SettingsCard>
      <div className="border-b border-black/[0.04] px-5 py-4 dark:border-white/[0.06]">
        <h3 className="text-[15px] font-semibold text-light-text dark:text-dark-text">{title}</h3>
        <p className="mt-0.5 text-[13px] text-light-muted dark:text-dark-muted">{description}</p>
      </div>
      <div className="space-y-3 p-5">
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          className="h-40 w-full resize-y rounded-xl border border-black/[0.08] bg-light-secondary p-3 font-mono text-[13px] leading-relaxed text-light-text outline-none transition-all placeholder:text-light-muted/60 focus:border-[#21c063] focus:ring-2 focus:ring-[#21c063]/20 dark:border-white/[0.1] dark:bg-dark-tertiary dark:text-dark-text dark:placeholder:text-dark-muted/50"
        />
        <div className="flex items-center gap-3">
          <ActionButton onClick={onSave}>{t("settings.advanced.save", { title })}</ActionButton>
          {saved && <StatusBanner tone="success">{t("settings.advanced.applied")}</StatusBanner>}
        </div>
      </div>
    </SettingsCard>
  )
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <SettingsCard>
      <div className="border-b border-black/[0.04] px-5 py-4 dark:border-white/[0.06]">
        <h3 className="text-[15px] font-semibold text-light-text dark:text-dark-text">{title}</h3>
        <p className="mt-0.5 text-[13px] text-light-muted dark:text-dark-muted">{description}</p>
      </div>
      <div className="space-y-3 p-5">{children}</div>
    </SettingsCard>
  )
}

const AdvancedScreen = () => {
  const t = useT()
  const [customCSS, setCustomCSS] = useState("")
  const [customJS, setCustomJS] = useState("")
  const [proxyURL, setProxyURL] = useState("")
  const [proxyBusy, setProxyBusy] = useState(false)
  const [proxyResult, setProxyResult] = useState<string | null>(null)
  const [stickerPackID, setStickerPackID] = useState("")
  const [stickerBusy, setStickerBusy] = useState(false)
  const [stickerResult, setStickerResult] = useState<string | null>(null)
  const [cssSaved, setCssSaved] = useState(false)
  const [jsSaved, setJsSaved] = useState(false)
  const [reloadMsg, setReloadMsg] = useState<string | null>(null)

  useEffect(() => {
    GetCustomCSS().then(setCustomCSS)
    GetCustomJS().then(setCustomJS)
  }, [])

  useEffect(() => {
    if (!cssSaved) return
    const t = setTimeout(() => setCssSaved(false), 2000)
    return () => clearTimeout(t)
  }, [cssSaved])

  useEffect(() => {
    if (!jsSaved) return
    const t = setTimeout(() => setJsSaved(false), 2000)
    return () => clearTimeout(t)
  }, [jsSaved])

  useEffect(() => {
    if (!reloadMsg) return
    const t = setTimeout(() => setReloadMsg(null), 2000)
    return () => clearTimeout(t)
  }, [reloadMsg])

  const applyCustomCode = (code: string, id: string, tag: "style" | "script") => {
    const oldElement = document.getElementById(id)
    if (oldElement) oldElement.remove()

    if (code) {
      const element = document.createElement(tag)
      element.id = id
      element.innerHTML = code
      document[tag === "style" ? "head" : "body"].appendChild(element)
    }
  }

  const handleSaveCSS = async () => {
    await SetCustomCSS(customCSS)
    applyCustomCode(customCSS, "custom-css", "style")
    setCssSaved(true)
  }

  const handleSaveJS = async () => {
    await SetCustomJS(customJS)
    applyCustomCode(customJS, "custom-js", "script")
    setJsSaved(true)
  }

  const handleReloadCustom = async () => {
    const [css, js] = await Promise.all([GetCustomCSS(), GetCustomJS()])
    setCustomCSS(css)
    setCustomJS(js)
    applyCustomCode(css, "custom-css", "style")
    applyCustomCode(js, "custom-js", "script")
    setReloadMsg(t("settings.advanced.reloadDone"))
  }

  const handleReinitialize = async () => {
    await Reinitialize()
    setReloadMsg(t("settings.advanced.sessionDone"))
  }

  return (
    <div className="flex flex-col gap-5">
      <ComponentColorSelector />
      <EaseVisualizer />

      <CodeEditorCard
        title={t("settings.advanced.cssTitle")}
        description={t("settings.advanced.cssDesc")}
        value={customCSS}
        onChange={setCustomCSS}
        onSave={handleSaveCSS}
        placeholder={t("settings.advanced.cssPlaceholder")}
        saved={cssSaved}
      />

      <CodeEditorCard
        title={t("settings.advanced.jsTitle")}
        description={t("settings.advanced.jsDesc")}
        value={customJS}
        onChange={setCustomJS}
        onSave={handleSaveJS}
        placeholder={t("settings.advanced.jsPlaceholder")}
        saved={jsSaved}
      />

      <SectionCard
        title={t("settings.advanced.reloadTitle")}
        description={t("settings.advanced.reloadDesc")}
      >
        <div className="flex items-center gap-3">
          <ActionButton variant="neutral" onClick={handleReloadCustom}>
            {t("settings.advanced.reloadButton")}
          </ActionButton>
          {reloadMsg && <StatusBanner tone="info">{reloadMsg}</StatusBanner>}
        </div>
      </SectionCard>

      <SectionCard
        title={t("settings.advanced.sessionTitle")}
        description={t("settings.advanced.sessionDesc")}
      >
        <ActionButton variant="neutral" onClick={handleReinitialize}>
          {t("settings.advanced.sessionButton")}
        </ActionButton>
      </SectionCard>

      <SectionCard
        title={t("settings.advanced.proxyTitle")}
        description={t("settings.advanced.proxyDesc")}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextField
            value={proxyURL}
            onChange={e => setProxyURL(e.target.value)}
            placeholder={t("settings.advanced.proxyPlaceholder")}
          />
          <ActionButton
            variant="neutral"
            disabled={proxyBusy || !proxyURL.trim()}
            onClick={async () => {
              setProxyBusy(true)
              setProxyResult(null)
              try {
                await SetProxy(proxyURL)
                setProxyResult(t("settings.advanced.proxySet"))
              } catch (err) {
                setProxyResult(String(err))
              } finally {
                setProxyBusy(false)
              }
            }}
          >
            {proxyBusy ? t("settings.advanced.settingProxy") : t("settings.advanced.setProxy")}
          </ActionButton>
        </div>
        {proxyResult && (
          <StatusBanner tone={proxyResult === t("settings.advanced.proxySet") ? "success" : "error"}>
            {proxyResult}
          </StatusBanner>
        )}
      </SectionCard>

      <SectionCard
        title={t("settings.advanced.stickerTitle")}
        description={t("settings.advanced.stickerDesc")}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextField
            value={stickerPackID}
            onChange={e => setStickerPackID(e.target.value)}
            placeholder={t("settings.advanced.stickerPlaceholder")}
          />
          <ActionButton
            variant="neutral"
            disabled={stickerBusy || !stickerPackID.trim()}
            onClick={async () => {
              setStickerBusy(true)
              setStickerResult(null)
              try {
                await FetchStickerPack(stickerPackID.trim())
                setStickerResult(t("settings.advanced.fetched"))
              } catch (err) {
                setStickerResult(String(err))
              } finally {
                setStickerBusy(false)
              }
            }}
          >
            {stickerBusy ? t("settings.advanced.fetching") : t("settings.advanced.fetch")}
          </ActionButton>
        </div>
        {stickerResult && (
          <StatusBanner tone={stickerResult === t("settings.advanced.fetched") ? "success" : "error"}>
            {stickerResult}
          </StatusBanner>
        )}
      </SectionCard>
    </div>
  )
}

export default AdvancedScreen