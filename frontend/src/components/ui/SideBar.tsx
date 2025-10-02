'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { useState, useEffect } from 'react'

interface SidebarProps {
  className?: string
  isMinimized?: boolean
  onToggleMinimize?: () => void
  onMinimize?: () => void
}

type Theme = 'light' | 'dark' | 'system'

export default function SideBar({ 
  className = '', 
  isMinimized = false, 
  onToggleMinimize, 
  onMinimize 
}: SidebarProps) {
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
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        )
      case 'dark':
        return (
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        )
      case 'system':
        return (
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )
    }
  }

  const navigation: Array<{
    name: string
    href: string
    icon: React.ReactNode
    onClick?: () => void
  }> = [
    {
      name: 'Explore',
      href: '/protected/explore',
      icon: (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      )
    },
    {
      name: 'Create Comic',
      href: '/protected/create',
      icon: (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      )
    },
    {
      name: 'My Comics',
      href: '/protected/comics',
      icon: (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    {
      name: 'Profile',
      href: '/protected/profile',
      icon: (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    }
  ]

  return (
    <div 
      className={`backdrop-blur-sm border-r h-screen flex flex-col transition-all duration-300 relative z-50 ${
        isMinimized ? 'w-16 cursor-pointer' : 'w-64'
      } ${className}`}
      style={{ 
        pointerEvents: 'auto',
        backgroundColor: 'var(--background-sidebar)',
        borderColor: 'var(--border)'
      }}
      onClick={isMinimized && onToggleMinimize ? onToggleMinimize : undefined}
    >
      {/* Logo/Brand */}
      <div className={`p-6 border-b flex-shrink-0 flex items-center ${
        isMinimized ? 'justify-center' : 'justify-between'
      }`}
      style={{ borderColor: 'var(--border)' }}>
         <Link 
           href="/protected/explore" 
           className={`flex items-center transition-all duration-300 ${isMinimized ? 'justify-center' : 'gap-2'}`}
           onClick={(e) => {
             e.stopPropagation()
             localStorage.setItem('lastVisitedPage', '/protected/explore')
           }}
         >
           <Image 
             src="/logo.png" 
             alt="PixelPanel Logo" 
             width={32} 
             height={32} 
             className="flex-shrink-0 object-contain"
           />
          <span className={`text-xl font-bold transition-all duration-300 whitespace-nowrap text-orange-500 leading-none ${
            isMinimized ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
          }`}>
            PixelPanel
          </span>
         </Link>
        {onToggleMinimize && !isMinimized && (
          <button
            onClick={onToggleMinimize}
            className="p-1 rounded-lg transition-colors"
            style={{ 
              color: 'var(--foreground)',
              backgroundColor: 'transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--background-tertiary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Navigation - Fixed height, no scroll */}
      <nav className="p-4 space-y-2 flex-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          const handleClick = () => {
            if (item.onClick) {
              item.onClick()
            }
          }
          
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                
                handleClick()
                
                // Navigate with delay to allow minimize to complete
                setTimeout(() => {
                  // Save the current page to localStorage before navigating
                  localStorage.setItem('lastVisitedPage', item.href)
                  router.push(item.href)
                }, item.onClick ? 200 : 50) // Longer delay if there's an onClick handler
              }}
              className={`flex items-center transition-all duration-300 ${isMinimized ? 'justify-center' : 'space-x-3'} px-3 py-2 rounded-lg text-sm font-medium transition-colors`}
              style={{
                backgroundColor: isActive ? 'var(--accent)' : 'transparent',
                color: isActive ? 'var(--foreground-inverse)' : 'var(--foreground-secondary)'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'var(--background-tertiary)'
                  e.currentTarget.style.color = 'var(--foreground)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = 'var(--foreground-secondary)'
                }
              }}
              title={isMinimized ? item.name : undefined}
            >
              {item.icon}
              <span className={`transition-all duration-300 whitespace-nowrap ${
                isMinimized ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
              }`}>
                {item.name}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* User Info & Actions */}
      <div className="p-4 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        {/* Theme Toggle */}
        <div className="relative mb-4 theme-menu">
          <button
            onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
            className={`w-full flex items-center transition-all duration-300 ${isMinimized ? 'justify-center' : 'justify-between'} px-3 py-2 text-sm rounded-lg transition-colors`}
            style={{ 
              color: 'var(--foreground-muted)',
              backgroundColor: 'transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--background-tertiary)'
              e.currentTarget.style.color = 'var(--foreground)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'var(--foreground-muted)'
            }}
            title={isMinimized ? 'Theme' : undefined}
          >
            <div className={`flex items-center transition-all duration-300 ${isMinimized ? 'space-x-0' : 'space-x-2'}`}>
              {getThemeIcon()}
              <span className={`transition-all duration-300 whitespace-nowrap ${
                isMinimized ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
              }`}>
                Theme
              </span>
            </div>
            {!isMinimized && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
          
          {isThemeMenuOpen && !isMinimized && (
            <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg shadow-lg z-10"
                 style={{
                   backgroundColor: 'var(--background-card)',
                   borderColor: 'var(--border)',
                   border: '1px solid'
                 }}>
              <button
                onClick={() => handleThemeChange('light')}
                className="w-full flex items-center space-x-2 px-3 py-2 text-sm rounded-t-lg transition-colors"
                style={{
                  backgroundColor: theme === 'light' ? 'var(--accent)' : 'transparent',
                  color: theme === 'light' ? 'var(--foreground-inverse)' : 'var(--foreground-muted)'
                }}
                onMouseEnter={(e) => {
                  if (theme !== 'light') {
                    e.currentTarget.style.backgroundColor = 'var(--background-tertiary)'
                    e.currentTarget.style.color = 'var(--foreground)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (theme !== 'light') {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = 'var(--foreground-muted)'
                  }
                }}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span>Light</span>
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className="w-full flex items-center space-x-2 px-3 py-2 text-sm transition-colors"
                style={{
                  backgroundColor: theme === 'dark' ? 'var(--accent)' : 'transparent',
                  color: theme === 'dark' ? 'var(--foreground-inverse)' : 'var(--foreground-muted)'
                }}
                onMouseEnter={(e) => {
                  if (theme !== 'dark') {
                    e.currentTarget.style.backgroundColor = 'var(--background-tertiary)'
                    e.currentTarget.style.color = 'var(--foreground)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (theme !== 'dark') {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = 'var(--foreground-muted)'
                  }
                }}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                <span>Dark</span>
              </button>
              <button
                onClick={() => handleThemeChange('system')}
                className="w-full flex items-center space-x-2 px-3 py-2 text-sm rounded-b-lg transition-colors"
                style={{
                  backgroundColor: theme === 'system' ? 'var(--accent)' : 'transparent',
                  color: theme === 'system' ? 'var(--foreground-inverse)' : 'var(--foreground-muted)'
                }}
                onMouseEnter={(e) => {
                  if (theme !== 'system') {
                    e.currentTarget.style.backgroundColor = 'var(--background-tertiary)'
                    e.currentTarget.style.color = 'var(--foreground)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (theme !== 'system') {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = 'var(--foreground-muted)'
                  }
                }}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>System</span>
              </button>
            </div>
          )}
        </div>

        <div className={`flex items-center transition-all duration-300 mb-3 ${
          isMinimized ? 'justify-center' : 'space-x-3'
        }`}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--foreground-on-accent)' }}>
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className={`transition-all duration-300 overflow-hidden ${
            isMinimized ? 'opacity-0 w-0' : 'opacity-100 w-auto flex-1 min-w-0'
          }`}>
            <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
              {user?.email}
            </p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation() // Prevent sidebar expansion when clicking sign out
            signOut()
          }}
          className={`w-full flex items-center transition-all duration-300 ${isMinimized ? 'justify-center' : 'space-x-2'} px-3 py-2 text-sm rounded-lg transition-colors`}
          style={{ 
            color: 'var(--foreground-muted)',
            backgroundColor: 'transparent'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--background-tertiary)'
            e.currentTarget.style.color = 'var(--foreground)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = 'var(--foreground-muted)'
          }}
          title={isMinimized ? 'Sign Out' : undefined}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className={`transition-all duration-300 whitespace-nowrap ${
            isMinimized ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
          }`}>
            Sign Out
          </span>
        </button>
      </div>
    </div>
  )
}