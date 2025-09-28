'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { useState, useEffect } from 'react'

interface SidebarProps {
  className?: string
}

type Theme = 'light' | 'dark' | 'system'

export default function SideBar({ className = '' }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [theme, setTheme] = useState<Theme>('system')
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false)

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme
    if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
      setTheme(savedTheme)
    }
  }, [])

  // Apply theme changes
  useEffect(() => {
    const root = document.documentElement
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      root.classList.toggle('dark', systemTheme === 'dark')
    } else {
      root.classList.toggle('dark', theme === 'dark')
    }
    
    localStorage.setItem('theme', theme)
  }, [theme])

  // Handle click outside to close theme menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isThemeMenuOpen) {
        const target = event.target as Element
        if (!target.closest('.theme-menu')) {
          setIsThemeMenuOpen(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isThemeMenuOpen])

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme)
    setIsThemeMenuOpen(false)
  }

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        )
      case 'dark':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        )
      case 'system':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push('/auth/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const navItems = [
    { href: '/protected', label: 'Explore', icon: '🔍' },
    { href: '/protected/create', label: 'Create', icon: '✏️' },
    { href: '/protected/comics', label: 'My Comics', icon: '📚' },
    { href: '/protected/profile', label: 'Profile', icon: '👤' },
  ]

  return (
    <div className={`bg-background-sidebar backdrop-blur-sm border-r border-border h-screen w-64 flex flex-col ${className}`}>
      {/* Logo/Brand */}
      <div className="p-6 border-b border-border">
        <Link href="/protected" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <span className="text-foreground-inverse font-bold text-lg">P</span>
          </div>
          <span className="text-xl font-bold text-foreground">PixelPanel</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-2 flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-accent text-foreground-inverse'
                  : 'text-foreground-secondary hover:text-foreground hover:bg-background-tertiary'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User Info & Actions */}
      <div className="p-4 border-t border-border flex-shrink-0">
        {/* Theme Toggle */}
        <div className="relative mb-4 theme-menu">
          <button
            onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm text-foreground-secondary hover:text-foreground hover:bg-background-tertiary rounded-lg transition-colors"
          >
            <div className="flex items-center space-x-2">
              {getThemeIcon()}
              <span>Theme</span>
            </div>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {isThemeMenuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-background-card border border-border rounded-lg shadow-theme-lg z-10">
              <button
                onClick={() => handleThemeChange('light')}
                className={`w-full flex items-center space-x-2 px-3 py-2 text-sm rounded-t-lg transition-colors ${
                  theme === 'light'
                    ? 'bg-accent text-foreground-inverse'
                    : 'text-foreground-secondary hover:text-foreground hover:bg-background-tertiary'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span>Light</span>
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={`w-full flex items-center space-x-2 px-3 py-2 text-sm transition-colors ${
                  theme === 'dark'
                    ? 'bg-accent text-foreground-inverse'
                    : 'text-foreground-secondary hover:text-foreground hover:bg-background-tertiary'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                <span>Dark</span>
              </button>
              <button
                onClick={() => handleThemeChange('system')}
                className={`w-full flex items-center space-x-2 px-3 py-2 text-sm rounded-b-lg transition-colors ${
                  theme === 'system'
                    ? 'bg-accent text-foreground-inverse'
                    : 'text-foreground-secondary hover:text-foreground hover:bg-background-tertiary'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>System</span>
              </button>
            </div>
          )}
        </div>

        {/* User Info */}
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
            <span className="text-foreground-inverse text-sm font-medium">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {user?.email || 'User'}
            </p>
          </div>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-foreground-secondary hover:text-foreground hover:bg-background-tertiary rounded-lg transition-colors"
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