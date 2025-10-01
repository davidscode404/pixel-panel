'use client'

import { useEffect, useRef } from 'react'

interface ModalProps {
  children: React.ReactNode
  onClose: () => void
}

export function Modal({ children, onClose }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleClickOutside)

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
      document.body.style.overflow = 'unset'
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="relative max-w-full max-h-full overflow-hidden bg-background-card border-4 border-black"
      >
        {children}
      </div>
    </div>
  )
}