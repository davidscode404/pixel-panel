'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { buildApiUrl, API_CONFIG } from '@/config/api'

interface SidebarProps {
  className?: string
  isMinimized?: boolean
  onToggleMinimize?: () => void
  onMinimize?: () => void
}

type Theme = 'light' | 'dark' | 'system'

interface SubscriptionStatus {
  plan: string;
  status: string;
  credits: number;
  next_billing_date?: string;
}

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
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [credits, setCredits] = useState<number | null>(null)
  const [creditsLoading, setCreditsLoading] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null)
  const supabase = createClient()

  // Plan name mapping for proper capitalization
  const planNames: { [key: string]: string } = {
    free: 'Free',
    starter: 'Starter',
    pro: 'Pro',
    creator: 'Creator',
    contentMachine: 'Content Machine'
  };

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme
    if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
      setTheme(savedTheme)
    }
  }, [])

  const fetchUserCredits = async () => {
    try {
      setCreditsLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.USER_CREDITS), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setCredits(data.credits || 0)
      }
    } catch (error) {
      // Error fetching credits
    } finally {
      setCreditsLoading(false)
    }
  }

  const fetchSubscriptionStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.STRIPE_SUBSCRIPTION_STATUS), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const status: SubscriptionStatus = await response.json();
        setSubscriptionStatus(status);
      }
    } catch (error) {
      console.error('Error fetching subscription status:', error);
    }
  };

  // Fetch user credits and subscription status - only once when user is available
  useEffect(() => {
    if (user) {
      fetchUserCredits()
      fetchSubscriptionStatus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

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

  // Handle click outside to close menus
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

  // Close menus when sidebar is minimized
  useEffect(() => {
    if (isMinimized) {
      setIsUserMenuOpen(false)
      setIsThemeMenuOpen(false)
    }
  }, [isMinimized])

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme)
    setIsThemeMenuOpen(false)
  }

  const toggleUserMenu = () => {
    setIsUserMenuOpen(!isUserMenuOpen)
    setIsThemeMenuOpen(false)
  }

  const handleSignOut = () => {
    signOut()
    setIsUserMenuOpen(false)
  }

  const getUserInitials = () => {
    if (!user?.email) return 'U'
    return user.email.charAt(0).toUpperCase()
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
      href: '/app/explore',
      icon: (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      )
    },
    {
      name: 'Create Comic',
      href: '/app/create',
      icon: (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      )
    },
    {
      name: 'My Comics',
      href: '/app/comics',
      icon: (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    {
      name: 'Profile',
      href: '/app/profile',
      icon: (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
    {
      name: 'Billing',
      href: '/app/billing',
      icon: (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
        </svg>
      )
    }
  ]

  const getIcon = (iconName: string) => {
    const icons = {
      plus: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      book: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      search: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
      coins: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
        </svg>
      ),
      settings: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      language: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
      ),
      help: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      upgrade: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      learn: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      logout: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      ),
      chevronDown: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      ),
      chevronUp: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      ),
      chevronLeft: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      ),
      chevronRight: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      ),
      check: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )
    }
    return icons[iconName as keyof typeof icons] || null
  }

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
           href="/app/explore" 
           className={`flex items-center transition-all duration-300 ${isMinimized ? 'justify-center' : 'gap-2'}`}
           onClick={(e) => {
             e.stopPropagation()
             localStorage.setItem('lastVisitedPage', '/app/explore')
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

      {/* User Profile Button - always at the bottom */}
      <div className="relative">
        {/* User Profile Button */}
        <div className="p-2">
          <button
            onClick={toggleUserMenu}
            className={`w-full flex items-center transition-all duration-300 ${
              isMinimized ? 'justify-center' : 'space-x-3'
            } p-3 rounded-lg transition-colors ${
              isUserMenuOpen 
                ? 'bg-stone-200 dark:bg-stone-700' 
                : 'hover:bg-stone-200 dark:hover:bg-stone-700'
            }`}
            style={{ 
              backgroundColor: isUserMenuOpen ? 'var(--background-tertiary)' : 'transparent',
              color: 'var(--foreground)'
            }}
            title={isMinimized ? 'User Profile' : undefined}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
              <span className="text-sm font-medium" style={{ color: 'var(--foreground-on-accent)' }}>
                {getUserInitials()}
              </span>
            </div>
            {!isMinimized && (
              <>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {user?.email?.split('@')[0] || 'User'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--foreground-secondary)' }}>
                    {planNames[subscriptionStatus?.plan || 'free'] || 'Free'} Plan
                  </p>
                </div>
                {getIcon(isUserMenuOpen ? 'chevronUp' : 'chevronDown')}
              </>
            )}
          </button>
        </div>

        {/* Expanded User Menu - positioned absolutely above the button */}
        {isUserMenuOpen && !isMinimized && (
          <div className="absolute bottom-full left-2 right-2 p-2 shadow-lg rounded-lg z-50" style={{ backgroundColor: 'var(--background-card)', border: '1px solid var(--border)' }}>
            <div className="space-y-4">
              {/* Credits Section */}
              <div className="p-3 rounded-lg shadow-sm" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Credits</span>
                  </div>
                  <div className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm" style={{ backgroundColor: 'var(--accent)', color: 'var(--foreground-on-accent)' }}>
                    {creditsLoading ? '...' : credits !== null ? credits : subscriptionStatus?.credits || 0}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'var(--foreground-secondary)' }}>Plan</span>
                    <span style={{ color: 'var(--foreground)' }}>
                      {planNames[subscriptionStatus?.plan || 'free'] || 'Free'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="space-y-1">

                <div className="relative">
                  <div 
                    onMouseEnter={() => setIsThemeMenuOpen(true)}
                    onMouseLeave={() => setIsThemeMenuOpen(false)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors hover:bg-stone-200 dark:hover:bg-stone-700"
                    style={{ color: 'var(--foreground)' }}
                  >
                    <span className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                      <span>Theme</span>
                    </span>
                    {getIcon(isThemeMenuOpen ? 'chevronLeft' : 'chevronRight')}
                  </div>

                  {isThemeMenuOpen && (
                    <>
                      {/* Invisible bridge to maintain hover */}
                      <div 
                        className="absolute left-full top-0 w-4 h-10 z-40" 
                        onMouseEnter={() => setIsThemeMenuOpen(true)}
                        onMouseLeave={() => setIsThemeMenuOpen(false)}
                      />
                      <div 
                        className="absolute left-full top-0 ml-4 rounded-lg shadow-lg overflow-hidden min-w-[120px] z-50" 
                        style={{ backgroundColor: 'var(--background-card)', border: '1px solid var(--border)' }}
                        onMouseEnter={() => setIsThemeMenuOpen(true)}
                        onMouseLeave={() => setIsThemeMenuOpen(false)}
                      >
              <button
                onClick={() => handleThemeChange('light')}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-sm transition-colors rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700"
                        style={{ color: 'var(--foreground)' }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span>Light</span>
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-sm transition-colors rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700"
                        style={{ color: 'var(--foreground)' }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                <span>Dark</span>
              </button>
              <button
                onClick={() => handleThemeChange('system')}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-sm transition-colors rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700"
                        style={{ color: 'var(--foreground)' }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>System</span>
              </button>
            </div>
                    </>
          )}
        </div>

                <button 
                  className="w-full flex items-center space-x-2 px-3 py-2 text-sm rounded-lg transition-colors hover:bg-stone-200 dark:hover:bg-stone-700"
                  style={{ color: 'var(--foreground)' }}
                >
                  {getIcon('language')}
                  <span>Language</span>
                </button>

                <button 
                  className="w-full flex items-center space-x-2 px-3 py-2 text-sm rounded-lg transition-colors hover:bg-stone-200 dark:hover:bg-stone-700"
                  style={{ color: 'var(--foreground)' }}
                >
                  {getIcon('help')}
                  <span>Get help</span>
                </button>

                <Link 
                  href="/app/profile"
                  className="w-full flex items-center space-x-2 px-3 py-2 text-sm rounded-lg transition-colors hover:bg-stone-200 dark:hover:bg-stone-700"
                  style={{ color: 'var(--foreground)' }}
                  onClick={() => setIsUserMenuOpen(false)}
                >
                  {getIcon('upgrade')}
                  <span>Upgrade plan</span>
                </Link>

                <Link 
                  href="/app/billing"
                  className="w-full flex items-center space-x-2 px-3 py-2 text-sm rounded-lg transition-colors hover:bg-stone-200 dark:hover:bg-stone-700"
                  style={{ color: 'var(--foreground)' }}
                  onClick={() => setIsUserMenuOpen(false)}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  <span>Manage subscription</span>
                </Link>

                <Link 
                  href="/privacy-policy"
                  className="w-full flex items-center space-x-2 px-3 py-2 text-sm rounded-lg transition-colors hover:bg-stone-200 dark:hover:bg-stone-700"
                  style={{ color: 'var(--foreground)' }}
                  onClick={() => setIsUserMenuOpen(false)}
                >
                  {getIcon('learn')}
                  <span>Privacy Policy</span>
                </Link>

          <Link
                  href="/terms-of-service"
                  className="w-full flex items-center space-x-2 px-3 py-2 text-sm rounded-lg transition-colors hover:bg-stone-200 dark:hover:bg-stone-700"
                  style={{ color: 'var(--foreground)' }}
                  onClick={() => setIsUserMenuOpen(false)}
                >
                  {getIcon('learn')}
                  <span>Terms of Service</span>
                </Link>

                <hr className="my-2" style={{ borderColor: 'var(--border)' }} />

                <button 
                  onClick={handleSignOut}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-sm rounded-lg transition-colors hover:bg-stone-200 dark:hover:bg-stone-700"
                  style={{ color: 'var(--foreground)' }}
                >
                  {getIcon('logout')}
                  <span>Log out</span>
                </button>
            </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}