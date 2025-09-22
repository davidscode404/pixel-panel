'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'

interface SidebarProps {
  className?: string
}

export default function SideBar({ className = '' }: SidebarProps) {
  const pathname = usePathname()
  const { user, signOut } = useAuth()

  const navigation = [
    {
      name: 'Explore',
      href: '/protected',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      )
    },
    {
      name: 'Create Comic',
      href: '/protected/create',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      )
    },
    {
      name: 'My Comics',
      href: '/protected/comics',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    {
      name: 'Profile',
      href: '/protected/profile',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    }
  ]

  return (
    <div className={`bg-stone-800/50 backdrop-blur-sm border-r border-stone-700 h-screen w-64 flex flex-col ${className}`}>
      {/* Logo/Brand */}
      <div className="p-6 border-b border-stone-700 flex-shrink-0">
        <Link href="/protected" className="flex items-center space-x-2">
          <svg className="w-8 h-8 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
          </svg>
          <span className="text-xl font-bold text-amber-50">PixelPanel</span>
        </Link>
      </div>

      {/* Navigation - Fixed height, no scroll */}
      <nav className="p-4 space-y-2 flex-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-amber-600 text-white'
                  : 'text-stone-300 hover:text-white hover:bg-stone-700/50'
              }`}
            >
              {item.icon}
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* User Info & Sign Out - Fixed at bottom */}
      <div className="p-4 border-t border-stone-700 flex-shrink-0">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-stone-200 truncate">
              {user?.email}
            </p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-stone-400 hover:text-white hover:bg-stone-700/50 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )
}