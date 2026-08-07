import { useEffect, type ReactNode } from "react"
import { createPortal } from "react-dom"

interface ModalProps {
  onClose: () => void
  children: ReactNode
  overlayClass?: string
  cardClass?: string
}

export function Modal({
  onClose,
  children,
  overlayClass = "fixed inset-0 z-50 flex items-center justify-center bg-black/40",
  cardClass = "w-96 max-w-[90vw] rounded-2xl bg-white p-6 shadow-xl dark:bg-dark-secondary",
}: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [onClose])

  return createPortal(
    <div
      className={overlayClass}
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={cardClass} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  )
}
