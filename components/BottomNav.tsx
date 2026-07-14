'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, BarChart2, BookOpen, Users, Settings } from 'lucide-react'

export function BottomNav() {
  const pathname = usePathname()

  const tabs = [
    { name: 'Today', href: '/', icon: Calendar },
    { name: 'Progress', href: '/progress', icon: BarChart2 },
    { name: 'Learn', href: '/learn', icon: BookOpen },
    { name: 'Community', href: '/community', icon: Users },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-divider bg-surface">
      <div className="mx-auto flex h-full max-w-md items-center justify-around px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = pathname === tab.href
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-0 px-1 transition-colors ${
                isActive ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="text-[10px] font-medium leading-none truncate w-full text-center">{tab.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
