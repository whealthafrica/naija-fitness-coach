import React from 'react'

type ButtonProps = {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'danger'
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  className?: string
}

export function Button({ children, variant = 'primary', onClick, type = 'button', disabled = false, className = '' }: ButtonProps) {
  const styles = {
    primary: 'bg-primary text-on-primary hover:opacity-90',
    secondary: 'bg-surface text-text-primary border border-divider hover:opacity-90',
    danger: 'bg-danger text-on-primary hover:opacity-90',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-5 py-3 rounded-2xl font-medium transition-opacity disabled:opacity-40 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
