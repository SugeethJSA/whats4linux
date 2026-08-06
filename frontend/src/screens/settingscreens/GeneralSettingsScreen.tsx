import { RowList, SwitchRow, SelectMenu, SettingRow } from "../../components/settings/ui-kit"
import { useAppSettingsStore } from "../../store/useAppSettingsStore"

const LANGUAGE_OPTIONS = [
  { value: "English", label: "English" },
  { value: "Spanish", label: "Spanish" },
  { value: "French", label: "French" },
]

const FONT_OPTIONS = [
  { value: "80%", label: "80%" },
  { value: "90%", label: "90%" },
  { value: "100% (Default)", label: "100% (Default)" },
  { value: "110%", label: "110%" },
  { value: "120%", label: "120%" },
  { value: "130%", label: "130%" },
]

const GeneralSettingsScreen = () => {
  const { startAtLogin, minimizeToTray, language, fontSize, updateSetting } = useAppSettingsStore()

  return (
    <div className="flex flex-col gap-5">
      <RowList>
        <SwitchRow
          title="Start Whatsapp at login"
          description="Launch Whatsapp automatically when you sign in to your computer"
          enabled={startAtLogin}
          onToggle={() => updateSetting("startAtLogin", !startAtLogin)}
        />
        <SwitchRow
          title="Minimize to system tray"
          description="Keep Whatsapp running after closing the application window"
          enabled={minimizeToTray}
          onToggle={() => updateSetting("minimizeToTray", !minimizeToTray)}
        />
      </RowList>

      <RowList>
        <SettingRow
          title="Language"
          description="Choose the language used by the app"
          control={
            <SelectMenu
              value={language}
              options={LANGUAGE_OPTIONS}
              onChange={value => updateSetting("language", value)}
            />
          }
        />
        <SettingRow
          title="Font size"
          description="Adjust the size of text throughout the app"
          control={
            <SelectMenu
              value={fontSize}
              options={FONT_OPTIONS}
              onChange={value => updateSetting("fontSize", value)}
            />
          }
        />
      </RowList>

      <div className="flex items-center gap-2 pl-1 text-[13px] text-light-muted dark:text-dark-muted">
        <span className="rounded-md border border-black/[0.08] px-1.5 py-0.5 text-[11px] font-semibold dark:border-white/[0.12]">
          Ctrl
        </span>
        +
        <span className="rounded-md border border-black/[0.08] px-1.5 py-0.5 text-[11px] font-semibold dark:border-white/[0.12]">
          + / -
        </span>
        <span>Use these keys to increase or decrease the font size</span>
      </div>
    </div>
  )
}

export default GeneralSettingsScreen
