import { memo } from "react"
import clsx from "clsx"
import { getAvatarColor } from "../../lib/utils"
import { UserAvatar, GroupIcon } from "../../assets/svgs/chat_icons"
import { useAppSettingsStore } from "../../store/useAppSettingsStore"

type AvatarSize = "xs" | "sm" | "md" | "lg"
type AvatarFallback = "initial" | "person" | "group"

const SIZE_CLASS: Record<AvatarSize, string> = {
  xs: "w-7 h-7",
  sm: "w-10 h-10",
  md: "w-12 h-12",
  lg: "w-20 h-20",
}

interface AvatarProps {
  name: string
  jid?: string
  avatar?: string
  size?: AvatarSize
  fallback?: AvatarFallback
  alt?: string
  className?: string
}

export const Avatar = memo(function Avatar({
  name,
  jid,
  avatar,
  size = "md",
  fallback = "initial",
  alt,
  className,
}: AvatarProps) {
  const dark = useAppSettingsStore(s => s.theme) === "dark"

  return (
    <div
      className={clsx(
        SIZE_CLASS[size],
        "rounded-full overflow-hidden shrink-0 flex items-center justify-center",
        className,
      )}
      style={!avatar ? { backgroundColor: getAvatarColor(jid || name, dark) } : undefined}
    >
      {avatar ? (
        <img src={avatar} alt={alt ?? name} className="w-full h-full object-cover" />
      ) : fallback === "person" ? (
        <UserAvatar />
      ) : fallback === "group" ? (
        <GroupIcon />
      ) : (
        <span className="text-sm font-semibold text-[#0a1014]">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  )
})
