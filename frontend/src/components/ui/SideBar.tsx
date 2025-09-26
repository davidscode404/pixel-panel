'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'

interface SidebarProps {
  className?: string
  isMinimized?: boolean
  onToggleMinimize?: () => void
  onMinimize?: () => void
}

export default function SideBar({ 
  className = '', 
  isMinimized = false, 
  onToggleMinimize, 
  onMinimize 
}: SidebarProps) {
  const pathname = usePathname()
  const { user, signOut } = useAuth()

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
      ),
      onClick: onMinimize // Add minimize functionality to Create Comic
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
    <div 
      className={`bg-stone-800/50 backdrop-blur-sm border-r border-stone-700 h-screen flex flex-col transition-all duration-300 ${
        isMinimized ? 'w-16 cursor-pointer' : 'w-64'
      } ${className}`}
      onClick={isMinimized && onToggleMinimize ? onToggleMinimize : undefined}
    >
      {/* Logo/Brand */}
      <div className={`p-6 border-b border-stone-700 flex-shrink-0 flex items-center ${
        isMinimized ? 'justify-center' : 'justify-between'
      }`}>
         <Link 
           href="/protected/explore" 
           className={`flex items-center transition-all duration-300 ${isMinimized ? 'justify-center' : 'space-x-2'}`}
           onClick={(e) => e.stopPropagation()}
         >
           <svg className="w-8 h-8 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
             <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
           </svg>
           <span className={`text-xl font-bold text-amber-50 transition-all duration-300 whitespace-nowrap ${
             isMinimized ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
           }`}>
             PixelPanel
           </span>
         </Link>
        {onToggleMinimize && !isMinimized && (
          <button
            onClick={onToggleMinimize}
            className="p-1 rounded-lg text-amber-50 hover:bg-stone-700/50 transition-colors"
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
                e.stopPropagation() // Prevent sidebar expansion when clicking nav items
                handleClick()
              }}
              className={`flex items-center transition-all duration-300 ${isMinimized ? 'justify-center' : 'space-x-3'} px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-amber-600 text-white'
                  : 'text-stone-300 hover:text-white hover:bg-stone-700/50'
              }`}
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

      {/* User Info & Sign Out - Fixed at bottom */}
      <div className="p-4 border-t border-stone-700 flex-shrink-0">
        <div className={`flex items-center transition-all duration-300 mb-3 ${
          isMinimized ? 'justify-center' : 'space-x-3'
        }`}>
          <div className="w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className={`transition-all duration-300 overflow-hidden ${
            isMinimized ? 'opacity-0 w-0' : 'opacity-100 w-auto flex-1 min-w-0'
          }`}>
            <p className="text-sm font-medium text-stone-200 truncate">
              {user?.email}
            </p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation() // Prevent sidebar expansion when clicking sign out
            signOut()
          }}
          className={`w-full flex items-center transition-all duration-300 ${isMinimized ? 'justify-center' : 'space-x-2'} px-3 py-2 text-sm text-stone-400 hover:text-white hover:bg-stone-700/50 rounded-lg transition-colors`}
          title={isMinimized ? 'Sign Out' : undefined}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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