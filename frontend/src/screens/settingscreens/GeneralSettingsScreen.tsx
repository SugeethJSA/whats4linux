import {
  RowList,
  SwitchRow,
  SelectMenu,
  SettingRow,
} from "../../components/settings/ui-kit"
import { useAppSettingsStore } from "../../store/useAppSettingsStore"
import { SUPPORTED_LANGUAGES, useT } from "../../lib/i18n"

const LANGUAGE_OPTIONS = SUPPORTED_LANGUAGES.map(lang => ({ value: lang, label: lang }))

const FONT_OPTIONS = [
  { value: "80%", label: "80%" },
  { value: "90%", label: "90%" },
  { value: "100% (Default)", label: "100% (Default)" },
  { value: "110%", label: "110%" },
  { value: "120%", label: "120%" },
  { value: "130%", label: "130%" },
]

const GeneralSettingsScreen = () => {
  const t = useT()
  const { startAtLogin, minimizeToTray, language, fontSize, updateSetting } =
    useAppSettingsStore()

  return (
    <div className="flex flex-col gap-5">
      <RowList>
        <SwitchRow
          title={t("settings.general.startAtLogin")}
          description={t("settings.general.startAtLogin.desc")}
          enabled={startAtLogin}
          onToggle={() => updateSetting("startAtLogin", !startAtLogin)}
        />
        <SwitchRow
          title={t("settings.general.tray")}
          description={t("settings.general.tray.desc")}
          enabled={minimizeToTray}
          onToggle={() => updateSetting("minimizeToTray", !minimizeToTray)}
        />
      </RowList>

      <RowList>
        <SettingRow
          title={t("settings.general.language")}
          description={t("settings.general.language.desc")}
          control={
            <SelectMenu
              value={language}
              options={LANGUAGE_OPTIONS}
              onChange={value => updateSetting("language", value)}
            />
          }
        />
        <SettingRow
          title={t("settings.general.fontSize")}
          description={t("settings.general.fontSize.desc")}
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
        <span>{t("settings.general.fontHint")}</span>
      </div>
    </div>
  )
}

export default GeneralSettingsScreen
