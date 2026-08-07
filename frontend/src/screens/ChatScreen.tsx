import { useEffect, useRef, useCallback, useState, memo } from "react"
import clsx from "clsx"
import {
  GetChatList,
  GetChannelList,
  SubscribeNewsletter,
  UnsubscribeNewsletter,
  SearchNewsletters,
  GetCachedAvatar,
  GetSelfAvatar,
  ToggleChatPin,
  ToggleChatArchive,
  ToggleChatLabel,
  DeleteChat,
  MarkChatAsRead,
  IsChatMuted,
  ToggleChatMute,
  BlockContact,
  UnblockContact,
  GetBlockList,
} from "../../wailsjs/go/api/Api"
import { api } from "../../wailsjs/go/models"
import { EventsOn } from "../../wailsjs/runtime/runtime"
import { ChatDetail } from "./ChatDetail"
import { useChatStore, useChatById, useFilteredChatIds, useArchivedCount, useUIStore } from "../store"
import { registerShortcut } from "../lib/shortcuts"
import { useSelfAvatarStore } from "../store/useSelfAvatarStore"
import { useChatMuted } from "../store/useMuteStore"
import type { ChatItem } from "../store/types"
import { StatusList, StoryViewer, type StatusGroup } from "../components/chat/Status"
import { CreateGroupDialog } from "../components/chat/CreateGroupDialog"
import { CreateChannelDialog } from "../components/chat/CreateChannelDialog"
import { CommunityList, CommunityHome, CommunitiesWelcome } from "../components/chat/Communities"
import { getAvatarColor, AVATAR_ICON_COLOR, AVATAR_ICON_ON_DARK } from "../lib/utils"
import { useAppSettingsStore } from "../store/useAppSettingsStore"
import {
  UserAvatar,
  NewChatIcon,
  MenuIcon,
  EmptyStateIcon,
  MutedBellIcon,
} from "../assets/svgs/chat_icons"
import { SearchIcon } from "../assets/svgs/settings_icons"
import { GoBackIcon } from "../assets/svgs/header_icons"
import { SearchPill } from "../components/common/SearchPill"
import { Avatar } from "../components/common/Avatar"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "../components/common/resizable"
import { MessageSearchScreen } from "./MessageSearchScreen"

interface HeaderProps {
  onOpenSettings: () => void
  onNewChat?: () => void
  onSearch?: () => void
  avatar?: string
}

const Header = ({ onOpenSettings, onNewChat, onSearch, avatar }: HeaderProps) => (
  <div className="h-16 bg-light-secondary dark:bg-dark-bg flex items-center justify-between px-4 border-b border-gray-200 dark:border-white/5">
    <h1 className="text-xl font-bold text-light-text dark:text-white">WhatsApp</h1>
    <div className="flex items-center gap-1 text-gray-500 dark:text-light-muted dark:text-dark-muted">
      <button
        title="Search Messages"
        onClick={onSearch}
        className="hover:bg-gray-100 dark:hover:bg-white/10 p-2 rounded-full"
      >
        <SearchIcon />
      </button>
      <button
        title="New Chat"
        onClick={onNewChat}
        className="hover:bg-gray-100 dark:hover:bg-white/10 p-2 rounded-full"
      >
        <NewChatIcon />
      </button>
      <button
        title="Menu"
        onClick={onOpenSettings}
        className="hover:bg-gray-100 dark:hover:bg-white/10 p-2 rounded-full"
      >
        <MenuIcon />
      </button>
      <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 overflow-hidden flex items-center justify-center ml-2">
        {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <UserAvatar />}
      </div>
    </div>
  </div>
)

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

const SearchBar = ({
  value,
  onChange,
  placeholder = "Search or start new chat",
}: SearchBarProps) => (
  <div className="px-3 py-2 bg-light-bg dark:bg-dark-bg">
    <SearchPill value={value} onChange={onChange} placeholder={placeholder} />
  </div>
)

const PeopleIcon = ({
  size = 24,
  color = AVATAR_ICON_COLOR,
}: {
  size?: number
  color?: string
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color} aria-hidden>
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
)

/**
 * WhatsApp community stacked avatar: rounded-square community badge behind a
 * circular group photo.
 */
const CommunityStackedAvatar = memo(
  ({
    communityAvatar,
    groupAvatar,
    communityName,
    groupName,
    communityJid,
    dark,
  }: {
    communityAvatar?: string
    groupAvatar?: string
    communityName: string
    groupName: string
    communityJid?: string
    dark?: boolean
  }) => {
    const communityBg = getAvatarColor(communityJid || communityName, dark)
    // Ring matches chat-list surface so the stack punches out cleanly.
    const ring = dark ? "#161717" : "#ffffff"
    const badge = "w-8 h-8"

    return (
      <div className="relative w-12 h-12 shrink-0 mr-4">
        <div
          className={clsx(
            "absolute left-0 top-0 overflow-hidden flex items-center justify-center rounded-[8px]",
            badge,
          )}
          style={{ backgroundColor: communityBg }}
        >
          {communityAvatar ? (
            <img src={communityAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <PeopleIcon size={18} color={AVATAR_ICON_COLOR} />
          )}
        </div>
        <div
          className={clsx(
            "absolute right-0 bottom-0 overflow-hidden flex items-center justify-center rounded-full",
            badge,
          )}
          style={{ boxShadow: `0 0 0 2px ${ring}` }}
        >
          {groupAvatar ? (
            <img src={groupAvatar} alt={groupName} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: dark ? "#2a3942" : "#111b21" }}
            >
              <PeopleIcon size={16} color={AVATAR_ICON_ON_DARK} />
            </div>
          )}
        </div>
      </div>
    )
  },
)

CommunityStackedAvatar.displayName = "CommunityStackedAvatar"

// Small WhatsApp-style pin glyph shown on pinned chat rows.
const PinIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" width="14" height="14" className={clsx("fill-current", className)}>
    <path d="M16 3a1 1 0 0 1 .95 1.31l-.9 2.72 3.42 3.42a1 1 0 0 1-.21 1.57l-3.62 2.07-1.9 4.75a1 1 0 0 1-1.64.33L9 16.07l-4.29 4.3-1.42-1.42 4.3-4.29-3.1-3.1a1 1 0 0 1 .33-1.64l4.75-1.9 2.07-3.62A1 1 0 0 1 12.5 4z" />
  </svg>
)

interface ChatListItemContentProps {
  chat: ChatItem
  muted: boolean
  isSelected: boolean
  onSelect: (chat: ChatItem) => void
  onContextMenu: (e: React.MouseEvent, chat: ChatItem) => void
}

// Pure presentational component - memoized to prevent unnecessary re-renders
const ChatListItemContent = memo(
  ({ chat, muted, isSelected, onSelect, onContextMenu }: ChatListItemContentProps) => {
    const theme = useAppSettingsStore(s => s.theme)
    const dark = theme === "dark"
    const isCommunityChat = Boolean(chat.isCommunityGroup && chat.communityJid)
    const communityName = isCommunityChat ? chat.communityName || "Community" : null

    return (
      <div
        onClick={() => onSelect(chat)}
        onContextMenu={e => onContextMenu(e, chat)}
        className={clsx(
          "flex items-center px-3 py-3 mx-2 my-1 cursor-pointer rounded-xl transition-all duration-150",
          "hover:bg-gray-100/80 dark:hover:bg-white/5",
          isSelected && "bg-[#21c063]/10 dark:bg-[#21c063]/10 chat-row-selected",
        )}
      >
        {isCommunityChat ? (
          <CommunityStackedAvatar
            communityAvatar={chat.communityAvatar}
            groupAvatar={chat.avatar}
            communityName={chat.communityName || ""}
            groupName={chat.name}
            communityJid={chat.communityJid}
            dark={dark}
          />
        ) : (
          <Avatar
            name={chat.name}
            jid={chat.id}
            avatar={chat.avatar}
            size="md"
            className="mr-4"
            fallback={chat.type === "group" ? "group" : "person"}
          />
        )}
        <div className="flex-1 min-w-0">
          {communityName && (
            <div className="text-[13px] leading-snug text-gray-500 dark:text-[#8696a0] truncate">
              {communityName}
            </div>
          )}
          <div className="flex justify-between items-baseline mb-1">
            <h3 className="text-light-text dark:text-dark-text font-medium truncate">
              {chat.name}
            </h3>
            <div className="flex items-center gap-1 shrink-0">
              {muted && (
                <span className="text-gray-500 dark:text-[#8696a0]">
                  <MutedBellIcon />
                </span>
              )}
              <span
                className={clsx(
                  "text-xs",
                  chat.unreadCount
                    ? "font-medium text-[#1b9a58] dark:text-[#21c063]"
                    : "text-gray-500 dark:text-[#8696a0]",
                )}
              >
                {chat.timestamp
                  ? new Date(chat.timestamp * 1000).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "yesterday"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 text-sm text-gray-500 dark:text-[#8696a0] truncate [&_p]:inline [&_p]:m-0 ">
              {chat.isFromMe && <span className="mr-1 text-[#8696a0]">You: </span>}
              {chat.sender && chat.type === "group" && !chat.isFromMe && (
                <span className="mr-1">{chat.sender}: </span>
              )}
              <span
                className="[&_br]:hidden no-formatting"
                dangerouslySetInnerHTML={{ __html: chat.subtitle }}
              />
            </div>
            {chat.pinned && <PinIcon className="shrink-0 text-gray-400 dark:text-[#8696a0]" />}
            {chat.unreadCount ? (
              <span className="shrink-0 min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full bg-[#21c063] text-[#0a1014] text-xs font-semibold">
                {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    )
  },
)

ChatListItemContent.displayName = "ChatListItemContent"

interface ChatListItemProps {
  chatId: string
  isSelected: boolean
  onSelect: (chat: ChatItem) => void
  onContextMenu: (e: React.MouseEvent, chat: ChatItem) => void
}

// Container component that subscribes to specific chat data
const ChatListItem = memo(({ chatId, isSelected, onSelect, onContextMenu }: ChatListItemProps) => {
  // This hook only triggers re-render when THIS specific chat changes
  const chat = useChatById(chatId)
  // Boolean selector - only re-renders when THIS chat's muted flag flips
  const muted = useChatMuted(chatId)

  if (!chat) return null

  return (
    <ChatListItemContent
      chat={chat}
      muted={muted}
      isSelected={isSelected}
      onSelect={onSelect}
      onContextMenu={onContextMenu}
    />
  )
})

ChatListItem.displayName = "ChatListItem"

interface EmptyStateProps {
  hasChats: boolean
  isLoading: boolean
  onRefresh: () => void
}

const EmptyState = ({ hasChats, isLoading, onRefresh }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-light-muted dark:text-dark-muted p-8">
    <div
      className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
      style={{ background: "rgba(33,192,99,0.08)", color: "#21c063" }}
    >
      <SearchIcon />
    </div>
    <p className="text-center font-medium">
      {hasChats ? "No chats match your search." : "No chats available. Start a conversation!"}
    </p>
    <button
      onClick={onRefresh}
      disabled={isLoading}
      className="mt-6 px-6 py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
      style={{ background: "#21c063", color: "#0a1014" }}
    >
      {isLoading ? "Loading..." : "Refresh Chats"}
    </button>
  </div>
)

function SubscribeChannelDialog({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<api.ChatElement[]>([])
  const [searching, setSearching] = useState(false)

  const handleSubscribe = async (jid?: string) => {
    const target = (jid || input).trim()
    if (!target) return
    setBusy(true)
    setError("")
    setSuccess("")
    try {
      await SubscribeNewsletter(target)
      setSuccess("Subscribed successfully!")
      setTimeout(onClose, 1500)
    } catch (e: any) {
      setError(e?.message || "Failed to subscribe")
    } finally {
      setBusy(false)
    }
  }

  const handleUnsubscribe = async (jid: string) => {
    if (!confirm("Unsubscribe from this channel?")) return
    setBusy(true)
    setError("")
    try {
      await UnsubscribeNewsletter(jid)
      setSuccess("Unsubscribed!")
    } catch (e: any) {
      setError(e?.message || "Failed to unsubscribe")
    } finally {
      setBusy(false)
    }
  }

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await SearchNewsletters(searchQuery.trim())
        setSearchResults(results || [])
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="bg-white dark:bg-dark-secondary rounded-2xl w-96 max-h-[80vh] flex flex-col p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Subscribe to Channel
        </h2>
        <p className="text-sm text-gray-500 dark:text-light-muted dark:text-dark-muted mb-4">
          Enter a newsletter JID or search for channels.
        </p>
        <input
          autoFocus
          value={input}
          onChange={e => {
            setInput(e.target.value)
            setError("")
            setSuccess("")
          }}
          onKeyDown={e => {
            if (e.key === "Enter") handleSubscribe()
            if (e.key === "Escape") onClose()
          }}
          placeholder="Newsletter JID or invite code"
          className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-dark-tertiary text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 outline-none mb-3"
        />

        {/* Search newsletters */}
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search channels..."
          className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-dark-tertiary text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 outline-none mb-3"
        />

        {searching && <p className="text-xs text-gray-500 mb-2">Searching...</p>}

        {searchResults.length > 0 && (
          <div className="flex-1 overflow-y-auto max-h-40 mb-3 border border-gray-200 dark:border-dark-border rounded-lg">
            {searchResults.map(ch => (
              <div
                key={ch.jid}
                className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-white/5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-light-text dark:text-dark-text truncate">
                    {ch.full_name || ch.push_name || ch.jid}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-light-muted dark:text-dark-muted truncate">
                    {ch.jid}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0 ml-2">
                  <button
                    onClick={() => handleSubscribe(ch.jid)}
                    disabled={busy}
                    className="text-xs px-2 py-1 rounded bg-[#21c063] text-[#0a1014] hover:bg-[#1ea952] disabled:opacity-50"
                  >
                    Subscribe
                  </button>
                  <button
                    onClick={() => handleUnsubscribe(ch.jid)}
                    disabled={busy}
                    className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 disabled:opacity-50"
                  >
                    Unsub
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
        {success && <p className="text-sm text-[#21c063] mb-3">{success}</p>}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-light-muted dark:text-dark-muted hover:bg-gray-100 dark:hover:bg-dark-tertiary rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => handleSubscribe()}
            disabled={busy || !input.trim()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[#21c063] text-[#0a1014] hover:bg-[#1ea952] disabled:opacity-50"
          >
            {busy ? "Subscribing..." : "Subscribe"}
          </button>
        </div>
      </div>
    </div>
  )
}

const WelcomeScreen = () => (
  <div
    className="flex-1 flex flex-col items-center justify-center z-10 text-center px-10 relative overflow-hidden"
    style={{ borderBottom: "6px solid #21c063" }}
  >
    <div
      className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20"
      style={{
        background: "radial-gradient(circle at center, rgba(33,192,99,0.15) 0%, transparent 60%)",
      }}
    />

    <div className="mb-8 relative z-10">
      <div
        className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl glass-light dark:glass"
        style={{
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <EmptyStateIcon />
      </div>
    </div>

    <h1
      className="text-3xl font-semibold mb-4 relative z-10"
      style={{ color: "var(--color-light-text)", letterSpacing: "-0.02em" }}
    >
      WhatsApp for Linux
    </h1>

    <p className="relative z-10 text-sm leading-relaxed" style={{ color: "#8696a0" }}>
      Send and receive messages without keeping your phone online.
      <br />
      Use WhatsApp on up to 4 linked devices and 1 phone.
    </p>
  </div>
)

interface ChatListScreenProps {
  onOpenSettings: () => void
}

export function ChatListScreen({ onOpenSettings }: ChatListScreenProps) {
  const screen = useUIStore(state => state.screen)
  // Use individual selectors to minimize re-renders
  const selectedChatId = useChatStore(state => state.selectedChatId)
  const selectedChat = useChatById(selectedChatId ?? "")
  const selectedChatName = selectedChat?.name ?? ""
  const selectedChatAvatar = selectedChat?.avatar
  const searchTerm = useChatStore(state => state.searchTerm)
  const setChats = useChatStore(state => state.setChats)
  const selfAvatar = useSelfAvatarStore(state => state.selfAvatar)
  const setSelfAvatar = useSelfAvatarStore(state => state.setSelfAvatar)
  const selectChat = useChatStore(state => state.selectChat)
  const setSearchTerm = useChatStore(state => state.setSearchTerm)
  const clearUnreadCount = useChatStore(state => state.clearUnreadCount)
  const updateChatLastMessage = useChatStore(state => state.updateChatLastMessage)
  const updateSingleChat = useChatStore(state => state.updateSingleChat)
  const getChat = useChatStore(state => state.getChat)

  const [showArchived, setShowArchived] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showSubscribeChannel, setShowSubscribeChannel] = useState(false)
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  // Get filtered chat IDs - only re-renders when IDs or search changes, not on message/timestamp updates
  const filteredChatIds = useFilteredChatIds(showArchived)
  const archivedCount = useArchivedCount()
  const totalChats = useChatStore(state => state.chatIds.length)

  // Keep the latest id list for the keyboard-shortcut handlers (they run from
  // a stable effect, so they must read refs, not stale closures).
  const filteredIdsRef = useRef(filteredChatIds)
  filteredIdsRef.current = filteredChatIds

  const isFetchingRef = useRef(false)
  const mountedRef = useRef(true)
  const initialFetchDoneRef = useRef(false)

  type SidebarView = "chats" | "communities" | "channels" | "status"
  const [view, setView] = useState<SidebarView>("chats")
  const [selectedCommunity, setSelectedCommunity] = useState<api.CommunitySummary | null>(null)
  // When opening a group from a community home, remember it so Back returns there.
  const [communityReturn, setCommunityReturn] = useState<api.CommunitySummary | null>(null)

  const handleChatSelect = useCallback(
    (chat: ChatItem) => {
      setSelectedCommunity(null)
      setCommunityReturn(null)
      selectChat(chat)
      clearUnreadCount(chat.id)
    },
    [selectChat, clearUnreadCount],
  )

  const handleCommunitySelect = useCallback(
    (community: api.CommunitySummary) => {
      selectChat(null)
      setCommunityReturn(null)
      setSelectedCommunity(community)
    },
    [selectChat],
  )

  const handleOpenGroupFromCommunity = useCallback(
    (jid: string, name: string, avatar?: string) => {
      if (selectedCommunity) {
        setCommunityReturn(selectedCommunity)
      }
      setSelectedCommunity(null)
      const chat: ChatItem = {
        id: jid,
        name,
        subtitle: "",
        type: "group",
        avatar,
      }
      selectChat(chat)
      clearUnreadCount(jid)
    },
    [selectedCommunity, selectChat, clearUnreadCount],
  )

  const handleBack = useCallback(() => {
    selectChat(null)
    // Return to community home if we came from there.
    if (communityReturn) {
      setSelectedCommunity(communityReturn)
      setCommunityReturn(null)
    }
  }, [selectChat, communityReturn])

  const transformChatElements = useCallback(
    async (chatElements: api.ChatElement[]): Promise<ChatItem[]> => {
      return Promise.all(
        chatElements.map(async c => {
          const isGroup = c.jid?.endsWith("@g.us") || false
          const avatar = c.avatar_url || ""
          // Sender is already resolved to a display name by the backend
          // (contact name for group senders, "You" for own messages).
          const senderName = c.is_from_me ? "You" : isGroup ? c.sender || "" : ""

          return {
            id: c.jid || "",
            name: c.full_name || c.push_name || c.short || c.phno || "Unknown",
            subtitle: (c.latest_message || "")
              .replace(/^\[call\].*?missed.*/, "📞 Missed call")
              .replace(/^\[call\].*/, "📞 Call")
              .replace(/^\[system\]/, ""),
            type: isGroup ? "group" : "contact",
            timestamp: c.LatestTS,
            avatar: avatar,
            sender: senderName || "",
            isFromMe: c.is_from_me || false,
            pinned: c.pinned || false,
            archived: c.archived || false,
            communityJid: c.parent_jid || undefined,
            communityName: c.parent_name || undefined,
            isCommunityGroup: Boolean(c.is_community_group && c.parent_jid),
            isCommunityParent: Boolean(c.is_community_parent),
          }
        }),
      )
    },
    [],
  )

  const loadAvatars = useCallback(
    async (chatItems: ChatItem[]) => {
      // Group avatars + community parent avatars for stacked logos.
      const jobs: Array<{ chatId: string; jid: string; field: "avatar" | "communityAvatar" }> = []
      for (const chat of chatItems) {
        if (!chat.avatar) {
          jobs.push({ chatId: chat.id, jid: chat.id, field: "avatar" })
        }
        if (chat.isCommunityGroup && chat.communityJid && !chat.communityAvatar) {
          jobs.push({ chatId: chat.id, jid: chat.communityJid, field: "communityAvatar" })
        }
      }

      if (jobs.length === 0) return

      const CONCURRENCY = 5
      let index = 0

      const worker = async () => {
        while (index < jobs.length) {
          const job = jobs[index++]

          try {
            const avatarURL = await GetCachedAvatar(job.jid, false)
            if (avatarURL && mountedRef.current) {
              useChatStore.getState().updateSingleChat(job.chatId, { [job.field]: avatarURL })
            }
          } catch (err) {
            console.error("Avatar load failed:", job.jid, err)
          }
        }
      }

      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
    },
    [updateSingleChat],
  )

  const loadSelfAvatar = useCallback(async () => {
    try {
      const avatarURL = await GetSelfAvatar(false)

      if (!mountedRef.current) {
        console.log("Component unmounted, aborting self avatar set")
        return
      }

      setSelfAvatar(avatarURL)
    } catch (err) {
      console.error("Failed to load self avatar:", err)
    }
  }, [setSelfAvatar])

  const [chatMenu, setChatMenu] = useState<{ x: number; y: number; chat: ChatItem } | null>(null)

  const handleChatContextMenu = useCallback((e: React.MouseEvent, chat: ChatItem) => {
    e.preventDefault()
    setChatMenu({ x: e.clientX, y: e.clientY, chat })
  }, [])

  // Dismiss the chat context menu on any click outside it.
  useEffect(() => {
    if (!chatMenu) return
    const close = () => setChatMenu(null)
    document.addEventListener("click", close)
    return () => document.removeEventListener("click", close)
  }, [chatMenu])

  const handleTogglePin = useCallback(async () => {
    if (!chatMenu) return
    const { chat } = chatMenu
    setChatMenu(null)
    const store = useChatStore.getState()
    // Optimistic: flip locally and re-sort; backend refresh confirms.
    store.updateSingleChat(chat.id, { pinned: !chat.pinned })
    store.resortChats()
    try {
      await ToggleChatPin(chat.id, !chat.pinned)
    } catch (err) {
      console.error("Failed to toggle chat pin:", err)
      store.updateSingleChat(chat.id, { pinned: chat.pinned })
      store.resortChats()
    }
  }, [chatMenu])

  // Leave the archived view automatically when the last chat is unarchived,
  // and when switching to Channels/Status tabs.
  useEffect(() => {
    if (showArchived && archivedCount === 0) setShowArchived(false)
  }, [showArchived, archivedCount])
  useEffect(() => {
    if (view !== "chats") setShowArchived(false)
  }, [view])

  // ESC leaves the archived view (and closes the context menu). When a chat
  // is open, ChatDetail's own ESC handler takes precedence — skip here so a
  // single press doesn't trigger both.
  useEffect(() => {
    if (!showArchived && !chatMenu && !selectedCommunity) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (chatMenu) {
        setChatMenu(null)
        return
      }
      if (useChatStore.getState().selectedChatId) return
      if (selectedCommunity) {
        setSelectedCommunity(null)
        return
      }
      setShowArchived(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [showArchived, chatMenu, selectedCommunity])

  const handleToggleArchive = useCallback(async () => {
    if (!chatMenu) return
    const { chat } = chatMenu
    setChatMenu(null)
    const store = useChatStore.getState()
    store.updateSingleChat(chat.id, { archived: !chat.archived })
    try {
      await ToggleChatArchive(chat.id, !chat.archived)
    } catch (err) {
      console.error("Failed to toggle chat archive:", err)
      store.updateSingleChat(chat.id, { archived: chat.archived })
    }
  }, [chatMenu])

  const handleDeleteChat = useCallback(async () => {
    if (!chatMenu) return
    const { chat } = chatMenu
    if (!confirm(`Delete ${chat.name || "this chat"}?`)) return
    setChatMenu(null)
    const store = useChatStore.getState()
    try {
      await DeleteChat(chat.id)
      store.removeChat(chat.id)
    } catch (err) {
      console.error("Failed to delete chat:", err)
    }
  }, [chatMenu])

  const handleMarkAsRead = useCallback(async () => {
    if (!chatMenu) return
    const { chat } = chatMenu
    setChatMenu(null)
    try {
      await MarkChatAsRead(chat.id, true)
      useChatStore.getState().clearUnreadCount(chat.id)
    } catch (err) {
      console.error("Failed to mark chat as read:", err)
    }
  }, [chatMenu])

  // Global keyboard shortcuts that operate on the chat list / active chat.
  // Registered only while the chats screen is the visible one (the component
  // stays mounted underneath the settings screen).
  useEffect(() => {
    if (screen !== "chats") return

    const unregs: Array<() => void> = []

    const openChatById = (chatId: string | undefined) => {
      if (!chatId) return
      const chat = getChat(chatId)
      if (chat) handleChatSelect(chat)
    }

    const openChatAt = (index: number) => openChatById(filteredIdsRef.current?.[index])

    for (let i = 1; i <= 9; i++) {
      unregs.push(registerShortcut(`open-chat-${i}`, () => openChatAt(i - 1)))
    }

    unregs.push(
      registerShortcut("next-chat", () => {
        const ids = filteredIdsRef.current
        const sel = useChatStore.getState().selectedChatId
        const idx = sel ? ids.indexOf(sel) : -1
        if (idx >= 0 && idx < ids.length - 1) openChatById(ids[idx + 1])
        else if (idx < 0 && ids.length > 0) openChatById(ids[0])
      }),
      registerShortcut("prev-chat", () => {
        const ids = filteredIdsRef.current
        const sel = useChatStore.getState().selectedChatId
        const idx = sel ? ids.indexOf(sel) : -1
        if (idx > 0) openChatById(ids[idx - 1])
        else if (idx < 0 && ids.length > 0) openChatById(ids[ids.length - 1])
      }),
      registerShortcut("search", () => setShowSearch(true)),
      registerShortcut("search-chat", () => setShowSearch(true)),
      registerShortcut("new-chat", () => setShowCreateGroup(true)),
      registerShortcut("new-group", () => setShowCreateGroup(true)),
      // The backend has no unread flag, so this is a local visual mark, same
      // as the in-app unread badge behaviour.
      registerShortcut("mark-unread", () => {
        const id = useChatStore.getState().selectedChatId
        if (id) useChatStore.getState().updateSingleChat(id, { unreadCount: 1 })
      }),
      registerShortcut("mute-chat", () => {
        const id = useChatStore.getState().selectedChatId
        if (!id) return
        IsChatMuted(id)
          .then(muted => ToggleChatMute(id, !muted))
          .catch(err => console.error("Mute toggle failed:", err))
      }),
      registerShortcut("archive-chat", () => {
        const st = useChatStore.getState()
        const id = st.selectedChatId
        const chat = id ? st.getChat(id) : undefined
        if (!id || !chat) return
        const next = !chat.archived
        st.updateSingleChat(id, { archived: next })
        ToggleChatArchive(id, next).catch(() =>
          st.updateSingleChat(id, { archived: chat.archived }),
        )
      }),
      registerShortcut("pin-chat", () => {
        const st = useChatStore.getState()
        const id = st.selectedChatId
        const chat = id ? st.getChat(id) : undefined
        if (!id || !chat) return
        const next = !chat.pinned
        st.updateSingleChat(id, { pinned: next })
        st.resortChats()
        ToggleChatPin(id, next).catch(() => {
          st.updateSingleChat(id, { pinned: chat.pinned })
          st.resortChats()
        })
      }),
      registerShortcut("label-chat", () => {
        const st = useChatStore.getState()
        const id = st.selectedChatId
        const chat = id ? st.getChat(id) : undefined
        if (!chat) return
        setChatMenu({
          x: Math.round(window.innerWidth / 2) - 100,
          y: Math.round(window.innerHeight / 2) - 120,
          chat,
        })
      }),
      registerShortcut("block-chat", () => {
        const st = useChatStore.getState()
        const id = st.selectedChatId
        const chat = id ? st.getChat(id) : undefined
        if (!id || !chat) return
        if (
          chat.id.endsWith("@g.us") ||
          chat.id.endsWith("@broadcast") ||
          chat.id.endsWith("@newsletter")
        ) {
          return
        }
        GetBlockList()
          .then(list => {
            const blocked = (list || []).some(b => b.jid === id)
            return blocked ? UnblockContact(id) : BlockContact(id)
          })
          .catch(err => console.error("Block toggle failed:", err))
      }),
    )

    return () => unregs.forEach(unreg => unreg())
  }, [screen, handleChatSelect, getChat, setShowSearch, setShowCreateGroup, setChatMenu])

  const [chatLabelId, setChatLabelId] = useState("")
  const [storyGroup, setStoryGroup] = useState<StatusGroup | null>(null)
  const viewRef = useRef(view)
  viewRef.current = view

  const fetchChats = useCallback(async () => {
    if (isFetchingRef.current) return
    // Communities / status load their own data.
    if (viewRef.current === "communities" || viewRef.current === "status") return

    isFetchingRef.current = true

    try {
      const chatElements =
        viewRef.current === "channels" ? await GetChannelList() : await GetChatList()

      if (!mountedRef.current) return

      if (!chatElements || !Array.isArray(chatElements)) {
        setChats([])
        return
      }

      const items = await transformChatElements(chatElements)
      setChats(items)
      // Load avatars asynchronously without blocking the UI
      loadAvatars(items)
      loadSelfAvatar()
      initialFetchDoneRef.current = true
    } catch (err) {
      console.error("Error fetching chats:", err)
      setChats([])
    } finally {
      isFetchingRef.current = false
    }
  }, [setChats, transformChatElements])

  // Reload the list (and drop the open chat) when switching Chats/Channels.
  const viewInitRef = useRef(true)
  useEffect(() => {
    if (viewInitRef.current) {
      viewInitRef.current = false
      return
    }
    selectChat(null)
    setSelectedCommunity(null)
    setCommunityReturn(null)
    setChats([])
    // Status / communities have their own data paths.
    if (view === "chats" || view === "channels") fetchChats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  useEffect(() => {
    mountedRef.current = true

    // Initial fetch
    const timeout = setTimeout(fetchChats, 100)

    // Listen for new messages - update only the specific chat
    const unsubNewMessage = EventsOn(
      "wa:new_message",
      (data: {
        chatId: string
        messageText: string
        timestamp: number
        sender: string
        reaction?: string
        isFromMe?: boolean
      }) => {
        // Mark an incoming message unread unless it belongs to the chat that's
        // currently open. Read state via getState() to avoid a stale closure.
        if (!data.isFromMe && useChatStore.getState().selectedChatId !== data.chatId) {
          useChatStore.getState().incrementUnreadCount(data.chatId)
        }

        if (!initialFetchDoneRef.current) {
          // If we haven't done initial fetch, do a full fetch
          setTimeout(fetchChats, 500)
          return
        }

        // Check if we already have this chat in our list
        const existingChat = getChat(data.chatId)
        if (existingChat) {
          let previewText = data.messageText
          // Backend sends the raw push name; mirror the chat list's sender
          // resolution ("You" for own messages, name otherwise).
          let senderForUpdate = data.isFromMe ? "You" : data.sender
          if (data.reaction) {
            previewText = `${data.sender} reacted ${data.reaction} to: "${previewText}"`
            senderForUpdate = ""
          }

          // Update only this specific chat - no full re-fetch needed!
          updateChatLastMessage(
            data.chatId,
            previewText,
            data.timestamp,
            senderForUpdate,
            Boolean(data.isFromMe),
          )
        } else {
          // New chat we don't have - need to fetch to get avatar/name
          setTimeout(fetchChats, 500)
        }
      },
    )

    const unsubPictureUpdate = EventsOn("wa:picture_update", async (jid: string) => {
      if (!jid) return

      try {
        const avatarURL = await GetCachedAvatar(jid, true)

        updateSingleChat(jid, { avatar: avatarURL })

        if (selectedChatId === jid) {
          const existing = getChat(jid)
          if (existing) {
            selectChat({ ...existing, avatar: avatarURL })
          }
        }
      } catch (err) {
        console.error("Error updating avatar for", jid, err)
      }
    })

    // Fallback: listen for generic updates that require full refresh
    const unsubRefresh = EventsOn("wa:chat_list_refresh", () => {
      setTimeout(fetchChats, 500)
    })

    return () => {
      mountedRef.current = false
      clearTimeout(timeout)
      unsubNewMessage()
      unsubPictureUpdate()
      unsubRefresh()
    }
  }, [fetchChats, getChat, loadSelfAvatar, updateChatLastMessage, updateSingleChat])

  return (
    <div className="flex h-screen bg-light-secondary dark:bg-dark-bg overflow-hidden">
      {chatMenu && (
        <div
          className="fixed z-50 min-w-36 rounded-lg border border-gray-200 dark:border-dark-border bg-white py-1 shadow-lg dark:border-white/10 dark:bg-dark-secondary"
          style={{ top: chatMenu.y, left: chatMenu.x }}
        >
          <button
            onClick={handleTogglePin}
            className="w-full px-4 py-2 text-left text-sm text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-white/5"
          >
            {chatMenu.chat.pinned ? "Unpin chat" : "Pin chat"}
          </button>
          <button
            onClick={handleToggleArchive}
            className="w-full px-4 py-2 text-left text-sm text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-white/5"
          >
            {chatMenu.chat.archived ? "Unarchive chat" : "Archive chat"}
          </button>
          {(chatMenu.chat.unreadCount ?? 0) > 0 && (
            <button
              onClick={handleMarkAsRead}
              className="w-full px-4 py-2 text-left text-sm text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-white/5"
            >
              Mark as read
            </button>
          )}
          <button
            onClick={handleDeleteChat}
            className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-white/5"
          >
            Delete chat
          </button>
          <div className="border-t border-gray-200 dark:border-dark-border" />
          <div className="px-4 py-2">
            <div className="flex gap-1">
              <input
                className="flex-1 rounded border border-gray-300 dark:border-dark-border bg-transparent px-2 py-1 text-xs outline-none focus:border-[#21c063] text-light-text dark:text-dark-text"
                value={chatLabelId}
                onChange={e => setChatLabelId(e.target.value)}
                placeholder="Label ID"
                onClick={e => e.stopPropagation()}
              />
              <button
                onClick={async () => {
                  if (!chatLabelId.trim() || !chatMenu) return
                  try {
                    await ToggleChatLabel(chatMenu.chat.id, chatLabelId.trim(), true)
                  } catch (e) {
                    console.error("Failed to label chat:", e)
                  }
                  setChatLabelId("")
                  setChatMenu(null)
                }}
                className="rounded bg-[#21c063] px-2 py-1 text-xs font-medium text-[#0a1014]"
              >
                Label
              </button>
            </div>
          </div>
        </div>
      )}
      <ResizablePanelGroup className="h-full">
        {/* Chat List Sidebar */}
        <ResizablePanel
          defaultSize="30%"
          minSize="320px"
          maxSize="600px"
          className={clsx(
            "flex-col",
            "border-r border-gray-200 dark:border-dark-tertiary",
            "bg-white dark:bg-dark-bg h-full",
            selectedChatId || selectedCommunity ? "hidden md:flex" : "flex",
          )}
        >
          {showSearch ? (
            <MessageSearchScreen onClose={() => setShowSearch(false)} />
          ) : (
            <>
              <Header
                onOpenSettings={onOpenSettings}
                onNewChat={() => setShowCreateGroup(true)}
                onSearch={() => setShowSearch(true)}
                avatar={selfAvatar}
              />
              <div className="flex gap-2 px-3 pb-2 pt-1 overflow-x-auto">
                {(["chats", "communities", "channels", "status"] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={clsx(
                      "rounded-full border px-3 py-1 text-sm capitalize transition-colors shrink-0",
                      view === v
                        ? "border-transparent bg-[#d9fdd3] font-medium text-[#0a1014] dark:bg-[#e9edef] dark:text-[#0b141a]"
                        : "border-gray-300 dark:border-dark-border text-light-muted dark:text-dark-muted hover:bg-gray-100 dark:border-white/10 dark:text-[#8696a0] dark:hover:bg-white/5",
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
              {view !== "status" && (
                <SearchBar
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder={
                    view === "communities"
                      ? "Search communities"
                      : view === "channels"
                        ? "Search channels"
                        : "Search or start new chat"
                  }
                />
              )}

              {view === "channels" && (
                <div className="mx-3 mt-2 flex gap-2">
                  <button
                    onClick={() => setShowSubscribeChannel(true)}
                    className="flex-1 px-4 py-2 bg-[#21c063] text-[#0a1014] rounded-lg text-sm font-medium hover:bg-[#1ea952] transition-colors"
                  >
                    Subscribe
                  </button>
                  <button
                    onClick={() => setShowCreateChannel(true)}
                    className="flex-1 px-4 py-2 bg-white dark:bg-dark-tertiary border border-gray-300 dark:border-dark-border text-light-text dark:text-dark-text rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-dark-secondary transition-colors"
                  >
                    Create
                  </button>
                </div>
              )}

              {/* Archived entry (main view) / archived header (archived view) */}
              {!showArchived && view === "chats" && archivedCount > 0 && (
                <button
                  onClick={() => setShowArchived(true)}
                  className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-[#1a1a1a]"
                >
                  <span className="flex w-12 justify-center text-[#1b9a58] dark:text-[#21c063]">
                    <svg viewBox="0 0 24 24" width="20" height="20" className="fill-current">
                      <path d="M20.54 5.23 19.15 3.55A1.5 1.5 0 0 0 18 3H6a1.5 1.5 0 0 0-1.16.55L3.46 5.23A2 2 0 0 0 3 6.5V19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.5a2 2 0 0 0-.46-1.27ZM6.24 5h11.52l.81.97H5.44ZM5 19V8h14v11Zm8-5.5V11h-2v2.5H8.5L12 17l3.5-3.5Z" />
                    </svg>
                  </span>
                  <span className="flex-1 font-medium text-light-text dark:text-dark-text">
                    Archived
                  </span>
                  <span className="text-xs text-gray-500 dark:text-[#8696a0]">{archivedCount}</span>
                </button>
              )}
              {showArchived && (
                <div className="flex items-center gap-4 border-b border-gray-200 dark:border-dark-border px-4 py-3 dark:border-white/5">
                  <button
                    onClick={() => setShowArchived(false)}
                    className="text-light-muted dark:text-dark-muted hover:text-gray-700 dark:text-light-muted dark:text-dark-muted dark:hover:text-gray-200"
                    aria-label="Back to chats"
                  >
                    <GoBackIcon />
                  </button>
                  <span className="font-medium text-light-text dark:text-dark-text">Archived</span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                {view === "status" ? (
                  <StatusList onOpen={setStoryGroup} />
                ) : view === "communities" ? (
                  <CommunityList
                    searchTerm={searchTerm}
                    selectedJid={selectedCommunity?.jid ?? null}
                    onSelect={handleCommunitySelect}
                  />
                ) : filteredChatIds.length === 0 ? (
                  <EmptyState
                    hasChats={totalChats > 0}
                    isLoading={isFetchingRef.current}
                    onRefresh={fetchChats}
                  />
                ) : (
                  filteredChatIds.map(chatId => (
                    <ChatListItem
                      key={chatId}
                      chatId={chatId}
                      isSelected={selectedChatId === chatId}
                      onSelect={handleChatSelect}
                      onContextMenu={handleChatContextMenu}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </ResizablePanel>
        {storyGroup && <StoryViewer group={storyGroup} onClose={() => setStoryGroup(null)} />}

        <ResizableHandle />

        {/* Chat Detail */}
        <ResizablePanel
          defaultSize="70%"
          minSize="400px"
          className={clsx(
            "flex-col h-full",
            selectedCommunity
              ? "bg-light-secondary dark:bg-dark-bg"
              : "bg-[#efeae2] dark:bg-dark-bg",
            "relative",
            selectedChatId || selectedCommunity ? "flex" : "hidden md:flex",
          )}
        >
          {selectedChatId ? (
            <ChatDetail
              key={selectedChatId}
              chatId={selectedChatId}
              chatName={selectedChatName}
              chatAvatar={selectedChatAvatar}
              onBack={handleBack}
            />
          ) : selectedCommunity ? (
            <CommunityHome
              communityJid={selectedCommunity.jid}
              communityName={selectedCommunity.name}
              communityAvatar={selectedCommunity.avatar_url}
              onBack={() => setSelectedCommunity(null)}
              onOpenGroup={handleOpenGroupFromCommunity}
            />
          ) : view === "communities" ? (
            <CommunitiesWelcome />
          ) : (
            <WelcomeScreen />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
      {showCreateGroup && <CreateGroupDialog onClose={() => setShowCreateGroup(false)} />}
      {showSubscribeChannel && (
        <SubscribeChannelDialog onClose={() => setShowSubscribeChannel(false)} />
      )}
      {showCreateChannel && <CreateChannelDialog onClose={() => setShowCreateChannel(false)} />}
    </div>
  )
}
