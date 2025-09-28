'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import SideBar from '@/components/ui/SideBar'

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      const redirectUrl = encodeURIComponent(pathname)
      router.push(`/auth/login?redirect=${redirectUrl}`)
    }
  }, [user, loading, router, pathname])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <div style={{ color: 'var(--foreground)' }}>Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const toggleSidebar = () => {
    setIsSidebarMinimized(!isSidebarMinimized)
  }

  return (
    <div className="h-screen flex overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
      {/* Sidebar - Fixed */}
      <SideBar 
        isMinimized={isSidebarMinimized} 
        onToggleMinimize={toggleSidebar}
        onMinimize={() => setIsSidebarMinimized(true)}
      />
      
      {/* Main Content - Scrollable */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 p-6 overflow-y-auto" style={{ backgroundColor: 'var(--background)' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
