'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ProtectedPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to explore page by default
    router.replace('/protected/explore')
  }, [router])

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-200 mx-auto mb-4"></div>
        <p className="text-amber-50">Redirecting to explore...</p>
      </div>
    </div>
  )
}
