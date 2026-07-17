import React from 'react'

type ButtonProps = {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'danger'
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  className?: string
}

/**
 * SHARED PRIMARY BUTTON COMPONENT
 * -----------------------------------------------------------------------------
 * DESIGN SYSTEM LOCK:
 * To prevent layout drift across screens, all primary action buttons (CTAs) 
 * in the onboarding, patient dashboard, settings, and coach flows must import 
 * and use this component rather than writing custom-styled buttons.
 * 
 * Standardized Specifications:
 * - Border-radius: rounded-2xl (card/list row alignment)
 * - Height/Padding: py-4 px-6 (comfortable interactive touch target)
 * - Font: font-bold text-base
 * - Disabled colors: Burgundy muted pair (bg-[#D4A5B1], text-[#F5EDE1])
 * -----------------------------------------------------------------------------
 */
export function Button({ children, variant = 'primary', onClick, type = 'button', disabled = false, className = '' }: ButtonProps) {
  const styles = {
    primary: 'bg-primary text-on-primary hover:opacity-90 disabled:bg-[#D4A5B1] disabled:text-[#F5EDE1] disabled:opacity-100',
    secondary: 'bg-transparent text-primary border-2 border-primary hover:bg-primary/5 disabled:border-[#D4A5B1] disabled:text-[#D4A5B1] disabled:bg-transparent disabled:opacity-100',
    danger: 'bg-danger text-on-primary hover:opacity-90 disabled:opacity-40',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-6 py-4 rounded-2xl font-bold text-base transition-all duration-200 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
