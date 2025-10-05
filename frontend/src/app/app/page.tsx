'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ProtectedPage() {
  const router = useRouter()

  useEffect(() => {
    // Check localStorage for the last visited page
    const lastVisitedPage = localStorage.getItem('lastVisitedPage')

    // If user was on a specific page, redirect back to it
    if (lastVisitedPage && lastVisitedPage !== '/app') {
      router.replace(lastVisitedPage)
    }
    // Default to explore page for new users or direct navigation
    else {
      router.replace('/app/explore')
    }
  }, [router])

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-200 mx-auto mb-4"></div>
        <p className="text-amber-50">Redirecting...</p>
      </div>
    </div>
  )
}
