import { useEffect, useRef, useState } from "react"
import { Login, GetCustomCSS, GetCustomJS, SetWindowFocused } from "../wailsjs/go/api/Api"
import { EventsOn, BrowserOpenURL } from "../wailsjs/runtime/runtime"
import QRCode from "qrcode"
import { ChatListScreen } from "./screens/ChatScreen"
import { LoginScreen } from "./screens/LoginScreen"
import { SettingsScreen } from "./screens/SettingsScreen"
import { initSelf } from "./lib/self"
import { Lightbox } from "./components/Lightbox"
import { CallOverlay } from "./components/chat/CallOverlay"

import { useUIStore, useMessageStore } from "./store"
import { useAppSettingsStore } from "./store/useAppSettingsStore"
import { applyThemeClass } from "./lib/theme"
import { useMuteStore } from "./store/useMuteStore"

type Screen = "login" | "chats" | "settings"

function App() {
  const [screen, setScreen] = useState<Screen>("login")
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const loginStartedRef = useRef(false)
  const [status, setStatus] = useState<string>("waiting")
  const [historyProgress, setHistoryProgress] = useState<number | null>(null)

  const { theme, loaded } = useAppSettingsStore()
  const { notifications, addNotification, removeNotification } = useUIStore()

  useEffect(() => {
    useAppSettingsStore.getState().loadSettings()
  }, [])

  useEffect(() => {
    if (loaded) {
      applyThemeClass(theme)
    }
  }, [theme, loaded])

  // Open links inside message text in the system browser instead of navigating
  // the app's webview. Links are rendered as <a class="msg-link"> by the backend.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      const anchor = target?.closest?.("a.msg-link") as HTMLAnchorElement | null
      if (anchor) {
        e.preventDefault()
        const href = anchor.getAttribute("href")
        if (href) BrowserOpenURL(href)
      }
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])

  // Keep the backend informed of window focus so it only notifies when the
  // window is in the background.
  useEffect(() => {
    const onFocus = () => SetWindowFocused(true)
    const onBlur = () => SetWindowFocused(false)
    window.addEventListener("focus", onFocus)
    window.addEventListener("blur", onBlur)
    SetWindowFocused(document.hasFocus())
    return () => {
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("blur", onBlur)
    }
  }, [])

  useEffect(() => {
    GetCustomCSS().then(css => {
      if (css) {
        const style = document.createElement("style")
        style.id = "custom-css"
        style.innerHTML = css
        document.head.appendChild(style)
      }
    })

    GetCustomJS().then(js => {
      if (js) {
        const script = document.createElement("script")
        script.id = "custom-js"
        script.innerHTML = js
        document.body.appendChild(script)
      }
    })
  }, [])

  useEffect(() => {
    const unsubQR = EventsOn("wa:qr", async (qr: string) => {
      if (!canvasRef.current) return
      await QRCode.toCanvas(canvasRef.current, qr, {
        width: 300,
        color: { dark: "#000000", light: "#ffffff" },
      })
    })

    const unsubStatus = EventsOn("wa:status", (status: string) => {
      setStatus(status)
      if (status === "logged_in" || status === "success") {
        setScreen("chats")
        void initSelf()
        const nid = (window as any).__reconnectNotifId
        if (nid !== undefined) {
          removeNotification(nid)
          delete (window as any).__reconnectNotifId
        }
      } else if (status === "reconnecting") {
        const nid = addNotification("Reconnecting to WhatsApp...")
        // The "logged_in" or "disconnected" events will remove this.
        ;(window as any).__reconnectNotifId = nid
      } else if (status === "disconnected") {
        const nid = (window as any).__reconnectNotifId
        if (nid !== undefined) removeNotification(nid)
        delete (window as any).__reconnectNotifId
        addNotification("Disconnected from WhatsApp")
      }
    })

    const unsubDownload = EventsOn("download:complete", (fileName: string) => {
      const notificationId = addNotification(`Downloaded: ${fileName}`)
      setTimeout(() => {
        removeNotification(notificationId)
      }, 3000)
    })

    // Surface backend errors to the user as toast notifications.
    const unsubError = EventsOn("wa:error", (msg: string) => {
      const nid = addNotification(msg)
      setTimeout(() => removeNotification(nid), 6000)
    })

    // Keep the muted-chats store fresh so chat rows/info panels stay in sync
    // with mute changes made anywhere (this app, the phone, another device).
    const unsubMuteUpdate = EventsOn(
      "wa:chat_mute_update",
      (data: { chatId: string; muted: boolean }) => {
        if (!data?.chatId) return
        useMuteStore.getState().setMuted(data.chatId, !!data.muted)
      },
    )

    // Register all status listeners before starting login. Existing sessions
    // can complete quickly enough to otherwise lose the "logged_in" event.
    if (!loginStartedRef.current) {
      loginStartedRef.current = true
      void Login().catch(err => setStatus(`error: ${String(err)}`))
    }

    const unsubHistory = EventsOn(
      "wa:history_progress",
      (data: { done?: boolean; download?: number; upload?: number; total?: number }) => {
        if (data?.done) {
          setHistoryProgress(null)
        } else if (data?.total) {
          const downloaded = data.download ?? 0
          const uploaded = data.upload ?? 0
          const total = data.total
          setHistoryProgress(Math.round(((downloaded + uploaded) / (total * 2)) * 100))
        }
      },
    )

    return () => {
      unsubQR()
      unsubStatus()
      unsubDownload()
      unsubError()
      unsubMuteUpdate()
      unsubHistory()
    }
  }, [addNotification, removeNotification])

  // Periodically evict stale entries from transient UI caches and cap message stores
  useEffect(() => {
    const id = setInterval(() => {
      useUIStore.getState().evictStale()
      useMessageStore.getState().trimAllChats()
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen bg-light-secondary text-light-text dark:bg-dark-bg dark:text-white relative">
      {historyProgress !== null && (
        <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-gray-200 dark:bg-gray-800">
          <div
            className="h-full bg-[#21c063] transition-all duration-300 ease-out"
            style={{ width: `${historyProgress}%` }}
          />
        </div>
      )}
      <Lightbox />
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
        style={{ fontFamily: "Inter, system-ui, sans-serif" }}
      >
        {notifications.map(n => {
          const msg = n.message.toLowerCase()
          const isSuccess =
            msg.includes("downloaded") || msg.includes("logged_in") || msg.includes("success")
          const isError =
            msg.includes("error") || msg.includes("failed") || msg.includes("disconnect")
          const isWarning = msg.includes("reconnect")
          const cls = isSuccess
            ? "toast-success"
            : isError
              ? "toast-error"
              : isWarning
                ? "toast-warning"
                : "toast-info"
          const icon = isSuccess ? "✓" : isError ? "✕" : isWarning ? "⚠" : "ℹ"
          return (
            <div key={n.id} className={`toast-base ${cls}`}>
              <span style={{ fontSize: 14 }}>{icon}</span>
              <span>{n.message}</span>
            </div>
          )
        })}
      </div>

      {screen === "login" && <LoginScreen canvasRef={canvasRef} status={status} />}

      {(screen === "chats" || screen === "settings") && (
        <div className={screen === "settings" ? "hidden" : "contents"}>
          <ChatListScreen onOpenSettings={() => setScreen("settings")} />
        </div>
      )}

      {screen === "settings" && <SettingsScreen onBack={() => setScreen("chats")} />}
      <CallOverlay />
    </div>
  )
}

export default App
