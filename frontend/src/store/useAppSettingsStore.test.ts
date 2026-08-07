// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { GetSettings, SaveSettings } from "../../wailsjs/go/api/Api"
import { useAppSettingsStore, getEase } from "./useAppSettingsStore"
import { THEME, DEFAULT_EASES } from "../theme.config"

vi.mock("../../wailsjs/go/api/Api", () => ({
  GetSettings: vi.fn(),
  SaveSettings: vi.fn(),
}))

const getSettingsMock = vi.mocked(GetSettings)
const saveSettingsMock = vi.mocked(SaveSettings)

const storageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

function resetStore() {
  useAppSettingsStore.setState(useAppSettingsStore.getInitialState())
}

describe("useAppSettingsStore", () => {
  beforeEach(() => {
    resetStore()
    window.localStorage = storageMock as unknown as Storage
    storageMock.clear()
    getSettingsMock.mockReset()
    saveSettingsMock.mockReset()
    saveSettingsMock.mockResolvedValue(undefined)
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("starts with defaults and loaded=false", () => {
    const s = useAppSettingsStore.getState()
    expect(s.theme).toBe("light")
    expect(s.loaded).toBe(false)
    expect(s.language).toBe("English")
    expect(s.enterIsSend).toBe(false)
  })

  it("loadSettings merges saved settings over defaults", async () => {
    getSettingsMock.mockResolvedValue({
      language: "Swedish",
      fontSize: "110%",
      enterIsSend: true,
    })

    await useAppSettingsStore.getState().loadSettings()

    const s = useAppSettingsStore.getState()
    expect(s.loaded).toBe(true)
    expect(s.language).toBe("Swedish")
    expect(s.fontSize).toBe("110%")
    expect(s.enterIsSend).toBe(true)
    expect(s.theme).toBe("light")
    expect(s.readReceipts).toBe(true)
  })

  it("loadSettings normalizes an invalid persisted theme", async () => {
    getSettingsMock.mockResolvedValue({ theme: "neon" })

    await useAppSettingsStore.getState().loadSettings()

    expect(useAppSettingsStore.getState().theme).toBe("light")
  })

  it("loadSettings rewrites the stale black toggle-circle default", async () => {
    const staleColors = {
      ...THEME,
      Button: { ...THEME.Button, "toggle circle": "#000000" },
    }
    getSettingsMock.mockResolvedValue({ themeColors: staleColors })

    await useAppSettingsStore.getState().loadSettings()

    const colors = useAppSettingsStore.getState().themeColors
    expect(colors.Button["toggle circle"]).toBe("#ffffff")
    expect(colors.Button["toggle dark circle"]).toBe("#ffffff")
  })

  it("loadSettings falls back to defaults but keeps the cached theme on failure", async () => {
    window.localStorage.setItem("app-theme", "dark")
    getSettingsMock.mockRejectedValue(new Error("backend down"))

    await useAppSettingsStore.getState().loadSettings()

    const s = useAppSettingsStore.getState()
    expect(s.loaded).toBe(true)
    expect(s.theme).toBe("dark")
    expect(s.language).toBe("English")
  })

  it("updateSetting updates the store and persists the full settings", async () => {
    await useAppSettingsStore.getState().updateSetting("language", "French")

    expect(useAppSettingsStore.getState().language).toBe("French")
    expect(saveSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        language: "French",
        theme: "light",
        readReceipts: true,
      }),
    )
  })

  it("updateSetting caches theme changes locally", async () => {
    await useAppSettingsStore.getState().updateSetting("theme", "dark")

    expect(useAppSettingsStore.getState().theme).toBe("dark")
    expect(window.localStorage.getItem("app-theme")).toBe("dark")
  })

  it("toggleTheme flips between light and dark", async () => {
    await useAppSettingsStore.getState().toggleTheme()
    expect(useAppSettingsStore.getState().theme).toBe("dark")

    await useAppSettingsStore.getState().toggleTheme()
    expect(useAppSettingsStore.getState().theme).toBe("light")
  })

  it("updateThemeColor updates a single color and persists it", async () => {
    await useAppSettingsStore.getState().updateThemeColor("Chat Bubble", "sent bubble bg", "#112233")

    const colors = useAppSettingsStore.getState().themeColors
    expect(colors["Chat Bubble"]["sent bubble bg"]).toBe("#112233")
    expect(colors["Chat Bubble"]["received bubble bg"]).toBe("#ffffff")
    expect(saveSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        themeColors: expect.objectContaining({
          "Chat Bubble": expect.objectContaining({ "sent bubble bg": "#112233" }),
        }),
      }),
    )
  })

  it("updateEase updates a single easing action", async () => {
    const group = "DropDown" as const
    const action = "open" as const

    await useAppSettingsStore.getState().updateEase(group, action, "bounce.out")

    expect(getEase(group, action)).toBe("bounce.out")
    expect(useAppSettingsStore.getState().eases.DropDown.close).toBe(DEFAULT_EASES.DropDown.close)
    expect(saveSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eases: expect.objectContaining({
          DropDown: expect.objectContaining({ open: "bounce.out" }),
        }),
      }),
    )
  })

  it("still updates the store when persisting fails", async () => {
    saveSettingsMock.mockRejectedValue(new Error("disk full"))

    await useAppSettingsStore.getState().updateSetting("language", "German")

    expect(useAppSettingsStore.getState().language).toBe("German")
    await vi.waitFor(() => expect(console.error).toHaveBeenCalled())
  })
})
