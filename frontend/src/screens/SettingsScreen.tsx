import { useEffect, useState, useCallback } from "react"
import type { ReactNode } from "react"
import clsx from "clsx"
import { GetProfile, GetCachedAvatar, GetSelfAvatar } from "../../wailsjs/go/api/Api"
import { api } from "../../wailsjs/go/models"
import GeneralSettingsScreen from "./settingscreens/GeneralSettingsScreen"
import AccountSettingsScreen from "./settingscreens/AccountSettingsScreen"
import PrivacySettingsScreen from "./settingscreens/PrivacySettingsScreen"
import ChatsSettingsScreen from "./settingscreens/ChatsSettingsScreen"
import NotificationsSettingsScreen from "./settingscreens/NotificationsSettingsScreen"
import KeyBoardShortCuts from "./settingscreens/KeyBoardShortCuts"
import HelpAndFeedback from "./settingscreens/HelpAndFeedback"
import LogOut from "./settingscreens/LogOut"
import AdvancedScreen from "./settingscreens/AdvancedScreen"
import { useSelfAvatarStore } from "../store/useSelfAvatarStore.ts"
import {
  AccountIcon,
  BackIcon,
  BellIcon,
  ChatIcon,
  DotsIcon,
  HelpIcon,
  KeyboardIcon,
  LockIcon,
  LogoutIcon,
  SearchIcon,
  SettingsIcon,
  UserIcon,
} from "../assets/svgs/settings_icons"

type SettingsCategory =
  | "general"
  | "account"
  | "privacy"
  | "chats"
  | "notifications"
  | "shortcuts"
  | "help"
  | "logout"
  | "advanced"

interface SettingsItem {
  id: SettingsCategory
  label: string
  description?: string
  icon: ReactNode
  screen: ReactNode
  danger?: boolean
}

const settingsItems: SettingsItem[] = [
  {
    id: "general",
    label: "General",
    description: "Startup and Close",
    icon: <SettingsIcon />,
    screen: <GeneralSettingsScreen />,
  },
  {
    id: "account",
    label: "Account",
    description: "Security notifications, account info",
    icon: <AccountIcon />,
    screen: null,
  },
  {
    id: "privacy",
    label: "Privacy",
    description: "Blocked contacts, disappearing messages",
    icon: <LockIcon />,
    screen: <PrivacySettingsScreen />,
  },
  {
    id: "chats",
    label: "Chats",
    description: "Theme, wallpaper, chat settings",
    icon: <ChatIcon />,
    screen: <ChatsSettingsScreen />,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Messages, groups, sounds",
    icon: <BellIcon />,
    screen: <NotificationsSettingsScreen />,
  },
  {
    id: "shortcuts",
    label: "Keyboard shortcuts",
    description: "Quick actions",
    icon: <KeyboardIcon />,
    screen: <KeyBoardShortCuts />,
  },
  {
    id: "help",
    label: "Help and feedback",
    description: "Help centre, contact us, privacy policy",
    icon: <HelpIcon />,
    screen: <HelpAndFeedback />,
  },
  {
    id: "advanced",
    label: "Advanced",
    description: "CSS & JS editor, Developer options",
    icon: <DotsIcon />,
    screen: <AdvancedScreen />,
  },
  {
    id: "logout",
    label: "Log out",
    danger: true,
    icon: <LogoutIcon />,
    screen: <LogOut />,
  },
]

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [selectedCategory, setSelectedCategory] = useState<SettingsCategory | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [profile, setProfile] = useState<api.Contact | null>(null)
  const [nestedScreen, setNestedScreen] = useState<ReactNode | null>(null)
  const selfAvatar = useSelfAvatarStore(s => s.selfAvatar)
  const setSelfAvatar = useSelfAvatarStore(s => s.setSelfAvatar)

  const loadAvatar = useCallback(async () => {
    try {
      const avatarURL = await GetSelfAvatar(false)

      setSelfAvatar(avatarURL)
    } catch (err) {
      console.error("Self avatar load failed:", err)
    }
  }, [setSelfAvatar])

  useEffect(() => {
    GetProfile("").then(setProfile)

    loadAvatar()
  }, [])

  const handleNavigate = (anchor: ReactNode) => {
    setNestedScreen(anchor)
  }

  const renderContent = () => {
    if (!selectedCategory) {
      return (
        <div className="flex flex-col items-center gap-3 text-center px-8">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-2"
            style={{ background: "rgba(33,192,99,0.08)", border: "1px solid rgba(33,192,99,0.15)" }}>
            <SettingsIcon className="w-10 h-10" style={{ color: "#21c063" } as any} />
          </div>
          <h2 className="text-xl font-semibold text-light-text dark:text-dark-text" style={{ letterSpacing: "-0.02em" }}>Settings</h2>
          <p className="text-sm" style={{ color: "#8696a0" }}>Select a category to get started</p>
        </div>
      )
    }

    if (nestedScreen) {
      return (
        <div className="w-full max-w-2xl px-8 py-6 overflow-y-auto h-full">
          <button
            onClick={() => setNestedScreen(null)}
            className="flex items-center gap-2 mb-4 text-gray-500 dark:text-light-muted dark:text-dark-muted hover:text-gray-700 dark:hover:text-gray-200"
          >
            <BackIcon />
            <span>Back</span>
          </button>
          {nestedScreen}
        </div>
      )
    }

    const currentItem = settingsItems.find(i => i.id === selectedCategory)

    return (
      <div className="w-full px-8 py-6 overflow-y-auto h-full">
        <h2 className="text-2xl font-light mb-6 text-light-text dark:text-dark-text">
          {currentItem?.label}
        </h2>
        {selectedCategory === "account" ? (
          <AccountSettingsScreen onNavigate={handleNavigate} />
        ) : (
          currentItem?.screen
        )}
      </div>
    )
  }

  const filteredItems = settingsItems.filter(item =>
    item.label.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="flex h-screen bg-light-secondary dark:bg-dark-bg overflow-hidden">
      <Sidebar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        profile={profile}
        avatar={selfAvatar}
        items={filteredItems}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        onBack={onBack}
      />
      <div className="flex-1 bg-light-secondary dark:bg-dark-secondary flex flex-col items-center justify-center text-gray-500 dark:text-light-muted dark:text-dark-muted">
        {renderContent()}
      </div>
    </div>
  )
}

function Sidebar({
  searchTerm,
  onSearchChange,
  profile,
  avatar,
  items,
  selectedCategory,
  onSelectCategory,
  onBack,
}: any) {
  return (
    <div className="w-120 flex flex-col border-r border-gray-200 dark:border-dark-tertiary bg-white dark:bg-dark-bg">
      <div className="h-28 flex flex-col justify-end px-4 pb-2">
        <div className="flex items-center mb-4">
          <button
            onClick={onBack}
            className="mr-4 text-gray-500 dark:text-light-muted dark:text-dark-muted hover:text-gray-700 dark:hover:text-gray-200"
          >
            <BackIcon />
          </button>
          <h1 className="text-2xl font-semibold text-light-text dark:text-dark-text">Settings</h1>
        </div>
        <SearchBar value={searchTerm} onChange={onSearchChange} />
      </div>

      <ProfileCard profile={profile} avatar={avatar} />

      <div className="flex-1 overflow-y-auto">
        {items.map((item: SettingsItem) => (
          <SettingsMenuItem
            key={item.id}
            item={item}
            isSelected={selectedCategory === item.id}
            onClick={() => onSelectCategory(item.id)}
          />
        ))}
      </div>
    </div>
  )
}

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="bg-light-secondary dark:bg-dark-tertiary rounded-lg flex items-center px-3 py-1.5">
      <SearchIcon className="text-gray-500 dark:text-light-muted dark:text-dark-muted mr-2 w-4 h-4" />
      <input
        type="text"
        placeholder="Search settings"
        className="bg-transparent border-none outline-none text-sm w-full text-light-text dark:text-dark-text placeholder-gray-500"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

function ProfileCard({ profile, avatar }: { profile: api.Contact | null; avatar?: string | null }) {
  return (
    <div className="mx-3 my-2 rounded-xl cursor-pointer overflow-hidden transition-all duration-200 hover:opacity-90"
      style={{ background: "rgba(33,192,99,0.06)", border: "1px solid rgba(33,192,99,0.12)" }}>
      <div className="h-10 w-full" style={{ background: "linear-gradient(90deg, rgba(33,192,99,0.15) 0%, transparent 100%)" }} />
      <div className="flex items-center px-4 pb-3 -mt-6 gap-3">
        <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center shrink-0 bg-gray-300 dark:bg-gray-600"
          style={{ border: "3px solid rgba(33,192,99,0.4)", boxShadow: "0 0 12px rgba(33,192,99,0.2)" }}>
          {avatar ? (
            <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
          ) : profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <UserIcon />
          )}
        </div>
        <div className="pt-6">
          <h3 className="font-semibold text-sm text-light-text dark:text-dark-text" style={{ letterSpacing: "-0.01em" }}>
            {profile?.push_name || "Your Name"}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "#8696a0" }}>{profile?.phno}</p>
        </div>
      </div>
    </div>
  )
}

function SettingsMenuItem({
  item,
  isSelected,
  onClick,
}: {
  item: SettingsItem
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        "flex items-center px-3 py-2.5 cursor-pointer mx-2 my-0.5 rounded-xl transition-all duration-150",
        isSelected
          ? "bg-[#21c063]/8 dark:bg-[#21c063]/10"
          : "hover:bg-gray-100/80 dark:hover:bg-dark-tertiary/60",
      )}
      style={isSelected ? { borderLeft: "3px solid #21c063", paddingLeft: "calc(0.75rem - 3px)" } : {}}
    >
      <div
        className="settings-icon-wrap mr-4"
        style={{
          background: item.danger
            ? "rgba(231,76,60,0.1)"
            : isSelected
            ? "rgba(33,192,99,0.15)"
            : "rgba(134,150,160,0.1)",
          color: item.danger ? "#e74c3c" : isSelected ? "#21c063" : "#8696a0",
        }}
      >
        {item.icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3
          className={clsx("font-medium text-sm", !item.danger && !isSelected && "text-light-text dark:text-dark-text")}
          style={{
            color: item.danger ? "#e74c3c" : isSelected ? "#21c063" : undefined,
            letterSpacing: "-0.01em",
          }}
        >
          {item.label}
        </h3>
        {item.description && (
          <p className="text-xs mt-0.5" style={{ color: "#8696a0" }}>{item.description}</p>
        )}
      </div>
    </div>
  )
}
