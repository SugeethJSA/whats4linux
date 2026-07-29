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

const AdvancedScreen = () => {
  const [customCSS, setCustomCSS] = useState("")
  const [customJS, setCustomJS] = useState("")
  const [proxyURL, setProxyURL] = useState("")
  const [proxyBusy, setProxyBusy] = useState(false)
  const [proxyResult, setProxyResult] = useState("")
  const [stickerPackID, setStickerPackID] = useState("")
  const [stickerBusy, setStickerBusy] = useState(false)
  const [stickerResult, setStickerResult] = useState("")

  useEffect(() => {
    GetCustomCSS().then(setCustomCSS)
    GetCustomJS().then(setCustomJS)
  }, [])

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
    alert("Custom CSS saved and applied!")
  }

  const handleSaveJS = async () => {
    await SetCustomJS(customJS)
    applyCustomCode(customJS, "custom-js", "script")
    alert("Custom JS saved and applied!")
  }

  const handleReloadCustom = async () => {
    const [css, js] = await Promise.all([GetCustomCSS(), GetCustomJS()])
    setCustomCSS(css)
    setCustomJS(js)
    applyCustomCode(css, "custom-css", "style")
    applyCustomCode(js, "custom-js", "script")
    alert("Custom CSS and JS reloaded from disk!")
  }

  const handleReinitialize = async () => {
    await Reinitialize()
    alert("Reinitialized!")
  }

  return (
    <>
      <ComponentColorSelector />
      <EaseVisualizer />
      <CodeEditor
        title="Custom CSS"
        value={customCSS}
        onChange={setCustomCSS}
        onSave={handleSaveCSS}
        placeholder="/* Enter custom CSS here */"
      />

      <CodeEditor
        title="Custom JS"
        value={customJS}
        onChange={setCustomJS}
        onSave={handleSaveJS}
        placeholder="// Enter custom JS here"
      />

      <Section
        title="Reload Customizations"
        description="Reload custom CSS and JS from disk. Useful if you edited the files externally."
        buttonText="Reload CSS & JS"
        onClick={handleReloadCustom}
        buttonColor="blue"
      />

      <Section
        title="Session Management"
        description="Re-initialize the WhatsApp connection. Use this if you're experiencing sync issues."
        buttonText="Re-initialize Connection"
        onClick={handleReinitialize}
        buttonColor="gray"
      />

      {/* Proxy configuration */}
      <div className="mb-8 border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-medium mb-2 text-light-text dark:text-dark-text">Proxy</h3>
        <p className="text-sm text-gray-500 dark:text-light-muted dark:text-dark-muted mb-4">
          Set a SOCKS5 or HTTP proxy for the WhatsApp connection.
        </p>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-gray-300 dark:border-dark-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[#21c063] text-light-text dark:text-dark-text"
            value={proxyURL}
            onChange={e => setProxyURL(e.target.value)}
            placeholder="socks5://127.0.0.1:1080"
          />
          <button
            onClick={async () => {
              setProxyBusy(true)
              setProxyResult("")
              try {
                await SetProxy(proxyURL)
                setProxyResult("Proxy set!")
              } catch (err) {
                setProxyResult(String(err))
              } finally {
                setProxyBusy(false)
              }
            }}
            disabled={proxyBusy || !proxyURL.trim()}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {proxyBusy ? "Setting…" : "Set Proxy"}
          </button>
        </div>
        {proxyResult && (
          <p
            className={`mt-2 text-xs ${proxyResult === "Proxy set!" ? "text-green-500" : "text-red-500"}`}
          >
            {proxyResult}
          </p>
        )}
      </div>

      {/* Sticker Pack Fetch */}
      <div className="mb-8 border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-medium mb-2 text-light-text dark:text-dark-text">
          Sticker Pack
        </h3>
        <p className="text-sm text-gray-500 dark:text-light-muted dark:text-dark-muted mb-4">
          Fetch a sticker pack by its ID to download all stickers.
        </p>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-gray-300 dark:border-dark-border bg-transparent px-3 py-2 text-sm outline-none focus:border-[#21c063] text-light-text dark:text-dark-text"
            value={stickerPackID}
            onChange={e => setStickerPackID(e.target.value)}
            placeholder="Sticker pack ID"
          />
          <button
            onClick={async () => {
              setStickerBusy(true)
              setStickerResult("")
              try {
                await FetchStickerPack(stickerPackID.trim())
                setStickerResult(`Fetched pack successfully`)
              } catch (err) {
                setStickerResult(String(err))
              } finally {
                setStickerBusy(false)
              }
            }}
            disabled={stickerBusy || !stickerPackID.trim()}
            className="rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600 disabled:opacity-50"
          >
            {stickerBusy ? "Fetching…" : "Fetch"}
          </button>
        </div>
        {stickerResult && (
          <p
            className={`mt-2 text-xs ${stickerResult.startsWith("Fetched") ? "text-green-500" : "text-red-500"}`}
          >
            {stickerResult}
          </p>
        )}
      </div>
    </>
  )
}

function CodeEditor({ title, value, onChange, onSave, placeholder }: any) {
  return (
    <div className="mb-8">
      <h3 className="text-lg font-medium mb-2 text-light-text dark:text-dark-text">{title}</h3>
      <textarea
        className="w-full h-40 p-3 bg-white dark:bg-dark-tertiary border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-green-500"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button
        onClick={onSave}
        className="mt-2 px-4 py-2 bg-[#21c063] text-white rounded hover:bg-[#1b9a58] transition-colors"
      >
        Save {title}
      </button>
    </div>
  )
}

function Section({
  title,
  description,
  buttonText,
  onClick,
  buttonColor,
}: {
  title: string
  description: string
  buttonText: string
  onClick: () => void
  buttonColor: "blue" | "gray"
}) {
  const colors = {
    blue: "bg-blue-500 hover:bg-blue-600 text-white",
    gray: "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white",
  }

  return (
    <div className="mb-8 border-t border-gray-200 dark:border-gray-700 pt-6">
      <h3 className="text-lg font-medium mb-2 text-light-text dark:text-dark-text">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-light-muted dark:text-dark-muted mb-4">
        {description}
      </p>
      <button
        onClick={onClick}
        className={`px-4 py-2 rounded transition-colors ${colors[buttonColor]}`}
      >
        {buttonText}
      </button>
    </div>
  )
}

export default AdvancedScreen
