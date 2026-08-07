import { useRef, useEffect } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import clsx from "clsx"
import { useEase } from "../../store/useAppSettingsStore"

interface ToggleButtonProps {
  isEnabled: boolean
  onToggle: () => void
  disabled?: boolean
}

const ToggleButton = ({ isEnabled, onToggle, disabled }: ToggleButtonProps) => {
  const circleRef = useRef<HTMLDivElement>(null)

  const ease = useEase("ToggleButton", "slide")
  const easeRef = useRef(ease)

  useEffect(() => {
    easeRef.current = ease
  }, [ease])

  useGSAP(() => {
    if (!circleRef.current) return

    gsap.to(circleRef.current, {
      x: isEnabled ? 20 : 0,
      duration: 0.6,
      ease: easeRef.current,
      overwrite: "auto",
    })
  }, [isEnabled])

  return (
    <div
      onClick={disabled ? undefined : onToggle}
      className={clsx(
        "h-7 w-12 rounded-full flex items-center px-1 shrink-0 transition-colors duration-300",
        disabled && "opacity-40 pointer-events-none",
        isEnabled
          ? "bg-toggle-bg dark:bg-toggle-dark-bg"
          : "bg-toggle-closed dark:bg-toggle-dark-closed",
      )}
    >
      <div
        ref={circleRef}
        className="size-5 rounded-full bg-toggle-circle dark:bg-toggle-dark-circle border border-black/10 dark:border-transparent shadow-md"
      />
    </div>
  )
}

export default ToggleButton
