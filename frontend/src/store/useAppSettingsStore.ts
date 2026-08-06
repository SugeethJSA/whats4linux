import { create } from "zustand"
import { GetSettings, SaveSettings } from "../../wailsjs/go/api/Api"
import { DEFAULT_EASES, THEME, applyThemeColors } from "../theme.config"
import { cacheTheme, normalizeTheme, readCachedTheme } from "../lib/theme"

export type EaseGroup = keyof typeof DEFAULT_EASES
export type EaseAction<G extends EaseGroup = EaseGroup> = keyof (typeof DEFAULT_EASES)[G]

interface AppSettingsStore extends AppSettings {
  loaded: boolean

  loadSettings: () => Promise<void>
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>
  updateThemeColor: (group: keyof typeof THEME, label: string, value: string) => Promise<void>
  toggleTheme: () => Promise<void>
  updateEase: <G extends EaseGroup>(group: G, action: EaseAction<G>, ease: string) => Promise<void>
}

export interface AppSettings {
  // Theme
  theme: "light" | "dark"
  themeColors: typeof THEME
  eases: typeof DEFAULT_EASES

  // Privacy Settings
  readReceipts: boolean
  blockUnknown: boolean
  disableLinkPreviews: boolean

  // Notifications Settings
  messageNotifications: boolean
  showPreviews: boolean
  showReactionNotifications: boolean
  statusReactions: boolean
  callNotifications: boolean
  incomingCallSounds: boolean
  incomingSounds: boolean
  outgoingSounds: boolean

  // General Settings
  startAtLogin: boolean
  minimizeToTray: boolean
  language: string
  fontSize: string

  // Chats Settings
  spellCheck: boolean
  replaceTextWithEmojis: boolean
  enterIsSend: boolean
}

const defaultSettings: AppSettings = {
  theme: "light",
  themeColors: THEME,
  eases: DEFAULT_EASES,
  readReceipts: true,
  blockUnknown: false,
  disableLinkPreviews: false,

  messageNotifications: true,
  showPreviews: true,
  showReactionNotifications: true,
  statusReactions: true,
  callNotifications: true,
  incomingCallSounds: true,
  incomingSounds: true,
  outgoingSounds: true,

  startAtLogin: false,
  minimizeToTray: true,
  language: "English",
  fontSize: "100% (Default)",

  spellCheck: true,
  replaceTextWithEmojis: true,
  enterIsSend: false,
}

function extractSettings(state: AppSettingsStore): AppSettings {
  const {
    loaded: _loaded,
    loadSettings: _loadSettings,
    updateSetting: _updateSetting,
    updateThemeColor: _updateThemeColor,
    toggleTheme: _toggleTheme,
    updateEase: _updateEase,
    ...settings
  } = state
  return settings
}

export const useAppSettingsStore = create<AppSettingsStore>((set, get) => ({
  ...defaultSettings,
  loaded: false,

  loadSettings: async () => {
    try {
      const saved = await GetSettings()

      const merged = {
        ...defaultSettings,
        ...(saved ?? {}),
      }
      merged.theme = normalizeTheme(merged.theme)

      // Older builds shipped a black light-mode toggle knob (#000000) as the
      // default and persisted it into saved settings. Rewrite that stale
      // default to white so existing installs pick up the readable knob.
      const savedToggleCircle: string | undefined = merged.themeColors?.Button?.["toggle circle"]
      if (savedToggleCircle === "#000000") {
        merged.themeColors = {
          ...merged.themeColors,
          Button: { ...merged.themeColors.Button, "toggle circle": "#ffffff" },
        }
      }

      applyThemeColors(merged.themeColors)
      cacheTheme(merged.theme)

      set({
        ...merged,
        loaded: true,
      })
    } catch {
      // fallback to defaults, but keep the locally cached theme so a backend
      // failure does not flip a dark-mode user back to light
      applyThemeColors(defaultSettings.themeColors)

      set({ theme: readCachedTheme(), loaded: true })
    }
  },

  updateSetting: async (key, value) => {
    const next = { ...get(), [key]: value }

    if (key === "theme") {
      cacheTheme(next.theme)
    }

    SaveSettings(extractSettings(next)).catch(err => {
      console.error("Failed to save setting:", err)
    })

    set(next)
  },

  toggleTheme: async () => {
    const theme = get().theme === "light" ? "dark" : "light"
    await get().updateSetting("theme", theme)
  },

  updateThemeColor: async (group, label, value) => {
    const next = {
      ...get(),
      themeColors: {
        ...get().themeColors,
        [group]: {
          ...get().themeColors[group],
          [label]: value,
        },
      },
    }

    applyThemeColors(next.themeColors)
    SaveSettings(extractSettings(next)).catch(console.error)
    set(next)
  },

  updateEase: async (group, action, ease) => {
    const next = {
      ...get(),
      eases: {
        ...get().eases,
        [group]: {
          ...get().eases[group],
          [action]: ease,
        },
      },
    }

    SaveSettings(extractSettings(next)).catch(console.error)
    set(next)
  },
}))

/** Non-reactive read of a single ease value. */
export const getEase = <G extends EaseGroup>(group: G, action: EaseAction<G>) =>
  useAppSettingsStore.getState().eases[group][action]

/** Reactive selector for a single ease value. */
export const useEase = <G extends EaseGroup>(group: G, action: EaseAction<G>) =>
  useAppSettingsStore(state => state.eases[group][action])
