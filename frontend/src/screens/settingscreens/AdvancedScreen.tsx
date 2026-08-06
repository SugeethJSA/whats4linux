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
          <ActionButton onClick={onSave}>Save {title}</ActionButton>
          {saved && <StatusBanner tone="success">Applied and saved</StatusBanner>}
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
    setReloadMsg("Custom CSS and JS reloaded from disk")
  }

  const handleReinitialize = async () => {
    await Reinitialize()
    setReloadMsg("Connection re-initialized")
  }

  return (
    <div className="flex flex-col gap-5">
      <ComponentColorSelector />
      <EaseVisualizer />

      <CodeEditorCard
        title="Custom CSS"
        description="Inject custom styles that are applied across the entire app"
        value={customCSS}
        onChange={setCustomCSS}
        onSave={handleSaveCSS}
        placeholder="/* Enter custom CSS here */"
        saved={cssSaved}
      />

      <CodeEditorCard
        title="Custom JS"
        description="Inject custom scripts for advanced tweaks and experiments"
        value={customJS}
        onChange={setCustomJS}
        onSave={handleSaveJS}
        placeholder="// Enter custom JS here"
        saved={jsSaved}
      />

      <SectionCard
        title="Reload customizations"
        description="Reload custom CSS and JS from disk. Useful if you edited the files externally."
      >
        <div className="flex items-center gap-3">
          <ActionButton variant="neutral" onClick={handleReloadCustom}>
            Reload CSS & JS
          </ActionButton>
          {reloadMsg && <StatusBanner tone="info">{reloadMsg}</StatusBanner>}
        </div>
      </SectionCard>

      <SectionCard
        title="Session management"
        description="Re-initialize the WhatsApp connection. Use this if you're experiencing sync issues."
      >
        <ActionButton variant="neutral" onClick={handleReinitialize}>
          Re-initialize connection
        </ActionButton>
      </SectionCard>

      <SectionCard
        title="Proxy"
        description="Set a SOCKS5 or HTTP proxy for the WhatsApp connection"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextField
            value={proxyURL}
            onChange={e => setProxyURL(e.target.value)}
            placeholder="socks5://127.0.0.1:1080"
          />
          <ActionButton
            variant="neutral"
            disabled={proxyBusy || !proxyURL.trim()}
            onClick={async () => {
              setProxyBusy(true)
              setProxyResult(null)
              try {
                await SetProxy(proxyURL)
                setProxyResult("Proxy set!")
              } catch (err) {
                setProxyResult(String(err))
              } finally {
                setProxyBusy(false)
              }
            }}
          >
            {proxyBusy ? "Setting…" : "Set proxy"}
          </ActionButton>
        </div>
        {proxyResult && (
          <StatusBanner tone={proxyResult === "Proxy set!" ? "success" : "error"}>
            {proxyResult}
          </StatusBanner>
        )}
      </SectionCard>

      <SectionCard
        title="Sticker pack"
        description="Fetch a sticker pack by its ID to download all stickers"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextField
            value={stickerPackID}
            onChange={e => setStickerPackID(e.target.value)}
            placeholder="Sticker pack ID"
          />
          <ActionButton
            variant="neutral"
            disabled={stickerBusy || !stickerPackID.trim()}
            onClick={async () => {
              setStickerBusy(true)
              setStickerResult(null)
              try {
                await FetchStickerPack(stickerPackID.trim())
                setStickerResult("Fetched pack successfully")
              } catch (err) {
                setStickerResult(String(err))
              } finally {
                setStickerBusy(false)
              }
            }}
          >
            {stickerBusy ? "Fetching…" : "Fetch"}
          </ActionButton>
        </div>
        {stickerResult && (
          <StatusBanner tone={stickerResult.startsWith("Fetched") ? "success" : "error"}>
            {stickerResult}
          </StatusBanner>
        )}
      </SectionCard>
    </div>
  )
}

export default AdvancedScreen