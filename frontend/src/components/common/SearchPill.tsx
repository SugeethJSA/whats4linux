import type { KeyboardEvent, Ref } from "react"
import { SearchIcon } from "../../assets/svgs/settings_icons"

interface SearchPillProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
  inputRef?: Ref<HTMLInputElement>
  showIcon?: boolean
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
}

export function SearchPill({
  value,
  onChange,
  placeholder = "Search",
  autoFocus,
  inputRef,
  showIcon = true,
  onKeyDown,
}: SearchPillProps) {
  return (
    <div className="bg-light-tertiary dark:bg-dark-secondary rounded-full flex items-center px-4 py-2">
      {showIcon && (
        <div className="text-gray-500 dark:text-light-muted dark:text-dark-muted mr-4">
          <SearchIcon />
        </div>
      )}
      <input
        ref={inputRef}
        type="text"
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="bg-transparent border-none outline-none text-sm w-full text-light-text dark:text-dark-text placeholder-gray-500"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
    </div>
  )
}
