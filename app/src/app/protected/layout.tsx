'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import SideBar from '@/components/ui/SideBar'

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !user) {
      const redirectUrl = encodeURIComponent(pathname)
      router.push(`/auth/login?redirect=${redirectUrl}`)
    }
  }, [user, loading, router, pathname])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-900 to-stone-800">
        <div className="text-amber-50">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="h-screen bg-gradient-to-br from-stone-900 to-stone-800 flex overflow-hidden">
      {/* Sidebar - Fixed */}
      <SideBar />
      
      {/* Main Content - Scrollable */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
