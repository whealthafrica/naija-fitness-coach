'use client'

import { useEffect } from 'react'

export function PWARegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const register = () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('Service Worker registered successfully:', registration.scope)
          })
          .catch((error) => {
            console.error('Service Worker registration failed:', error)
          })
      }

      if (document.readyState === 'complete') {
        register()
      } else {
        window.addEventListener('load', register)
        return () => window.removeEventListener('load', register)
      }
    }
  }, [])

  return null
}
