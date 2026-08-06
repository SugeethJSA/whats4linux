import { useEffect, useState, useCallback } from "react"
import type { ReactNode } from "react"
import clsx from "clsx"
import { GetProfile, GetSelfAvatar } from "../../wailsjs/go/api/Api"
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
    icon: <SettingsIcon className="w-5 h-5" />,
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
  }, [loadAvatar])

  // "Profile and About" (Ctrl+Alt+P) opens settings directly on the Account
  // category. The event is dispatched by the App-level shortcut handler.
  useEffect(() => {
    const onOpenCategory = (e: Event) => {
      const category = (e as CustomEvent<string>).detail
      if (category === "account") setSelectedCategory("account")
    }
    window.addEventListener("wa:open-settings-category", onOpenCategory)
    return () => window.removeEventListener("wa:open-settings-category", onOpenCategory)
  }, [])

  const handleNavigate = (anchor: ReactNode) => {
    setNestedScreen(anchor)
  }

  const renderContent = () => {
    if (!selectedCategory) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#21c063]/10 text-[#21c063] shadow-[0_0_40px_rgba(33,192,99,0.15)]">
            <SettingsIcon className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-light-text dark:text-dark-text">
              Settings
            </h2>
            <p className="mt-1 text-sm text-light-muted dark:text-dark-muted">
              Select a category to get started
            </p>
          </div>
        </div>
      )
    }

    if (nestedScreen) {
      return (
        <div className="w-full max-w-3xl overflow-y-auto px-6 py-6 lg:px-10">
          <button
            onClick={() => setNestedScreen(null)}
            className="mb-5 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium text-light-muted transition-colors hover:bg-black/[0.04] hover:text-light-text dark:text-dark-muted dark:hover:bg-white/[0.06] dark:hover:text-dark-text"
          >
            <ChevronBack />
            Back
          </button>
          <div className="animate-slide-in-right">{nestedScreen}</div>
        </div>
      )
    }

    const currentItem = settingsItems.find(i => i.id === selectedCategory)

    return (
      <div className="w-full overflow-y-auto px-6 py-6 lg:px-10">
        <div className="mx-auto max-w-3xl animate-slide-in-right">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight text-light-text dark:text-dark-text">
            {currentItem?.label}
          </h2>
          <div className={clsx(!currentItem?.danger && "max-w-2xl")}>
            {selectedCategory === "account" ? (
              <AccountSettingsScreen onNavigate={handleNavigate} />
            ) : (
              currentItem?.screen
            )}
          </div>
        </div>
      </div>
    )
  }

  const filteredItems = settingsItems.filter(item =>
    item.label.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="flex h-screen overflow-hidden bg-light-secondary dark:bg-dark-bg">
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
      <div className="flex min-w-0 flex-1 flex-col bg-light-secondary dark:bg-dark-secondary">
        {renderContent()}
      </div>
    </div>
  )
}

function ChevronBack() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
    </svg>
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
    <div className="flex w-[380px] shrink-0 flex-col border-r border-black/[0.06] bg-white dark:border-white/[0.08] dark:bg-dark-bg">
      <div className="px-4 pb-3 pt-5">
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={onBack}
            className="rounded-xl p-2 text-light-muted transition-colors hover:bg-black/[0.05] hover:text-light-text dark:text-dark-muted dark:hover:bg-white/[0.07] dark:hover:text-dark-text"
            title="Back to chats"
          >
            <BackIcon />
          </button>
          <h1 className="text-lg font-semibold tracking-tight text-light-text dark:text-dark-text">
            Settings
          </h1>
        </div>
        <div className="group flex items-center gap-2.5 rounded-xl bg-light-secondary px-3 py-2 transition-all focus-within:ring-2 focus-within:ring-[#21c063]/25 dark:bg-dark-tertiary">
          <SearchIcon className="h-4 w-4 shrink-0 text-light-muted dark:text-dark-muted" />
          <input
            type="text"
            placeholder="Search settings"
            className="w-full bg-transparent text-sm text-light-text outline-none placeholder:text-light-muted/70 dark:text-dark-text dark:placeholder:text-dark-muted/60"
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange("")}
              className="text-light-muted/70 transition-colors hover:text-light-text dark:text-dark-muted/70 dark:hover:text-dark-text"
              title="Clear search"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <ProfileCard profile={profile} avatar={avatar} />

      <div className="mt-1 flex-1 overflow-y-auto pb-3">
        {items.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-light-muted dark:text-dark-muted">
            No settings match "{searchTerm}"
          </p>
        ) : (
          items.map((item: SettingsItem) => (
            <SettingsMenuItem
              key={item.id}
              item={item}
              isSelected={selectedCategory === item.id}
              onClick={() => onSelectCategory(item.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function ProfileCard({ profile, avatar }: { profile: api.Contact | null; avatar?: string | null }) {
  const avatarSrc = avatar || profile?.avatar_url || null
  return (
    <div className="mx-3 mb-1 overflow-hidden rounded-2xl border border-black/[0.06] bg-white transition-all hover:shadow-md dark:border-white/[0.08] dark:bg-dark-secondary">
      <div className="h-14 w-full bg-gradient-to-r from-[#21c063]/25 via-[#21c063]/10 to-transparent" />
      <div className="-mt-8 flex items-end gap-3 px-4 pb-3.5">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-light-tertiary ring-4 ring-white dark:bg-dark-elevated dark:ring-dark-secondary">
          {avatarSrc ? (
            <img src={avatarSrc} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            <UserIcon />
          )}
        </div>
        <div className="min-w-0 pb-0.5">
          <div className="truncate text-sm font-semibold text-light-text dark:text-dark-text">
            {profile?.push_name || "Your Name"}
          </div>
          <div className="truncate text-[12px] text-light-muted dark:text-dark-muted">
            {profile?.phno}
          </div>
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
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === "Enter" && onClick()}
      className={clsx(
        "mx-2 my-0.5 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150",
        isSelected ? "bg-[#21c063]/10" : "hover:bg-black/[0.03] dark:hover:bg-white/[0.05]",
      )}
    >
      <div
        className={clsx(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
          item.danger
            ? "bg-red-500/10 text-red-500"
            : isSelected
              ? "bg-[#21c063]/15 text-[#21c063]"
              : "bg-black/[0.04] text-light-muted dark:bg-white/[0.06] dark:text-dark-muted",
        )}
      >
        {item.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={clsx(
            "truncate text-sm font-medium",
            item.danger
              ? "text-red-500"
              : isSelected
                ? "text-[#21c063]"
                : "text-light-text dark:text-dark-text",
          )}
        >
          {item.label}
        </div>
        {item.description && (
          <div className="truncate text-[12px] text-light-muted dark:text-dark-muted">
            {item.description}
          </div>
        )}
      </div>
      {isSelected && (
        <span className="h-2 w-2 shrink-0 rounded-full bg-[#21c063] shadow-[0_0_8px_rgba(33,192,99,0.6)]" />
      )}
    </div>
  )
}
