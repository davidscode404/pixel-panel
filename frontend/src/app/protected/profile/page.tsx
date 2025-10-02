'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ProfilePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [credits, setCredits] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (user) {
      fetchUserCredits()
    }
  }, [user])

  const fetchUserCredits = async () => {
    try {
      // TODO: Replace with actual credits fetching from your database
      // For now, we'll simulate with a default value
      setCredits(10)
    } catch (error) {
      console.error('Error fetching credits:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>Profile</h1>
        <p style={{ color: 'var(--foreground-secondary)' }}>Manage your account settings</p>
      </div>

      {/* Credits Section */}
      <div className="p-6 rounded-lg border mb-6" style={{ backgroundColor: 'var(--background-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center justify-center w-20 h-20 rounded-full font-bold text-2xl" style={{ backgroundColor: 'var(--accent)', color: 'var(--foreground-on-accent)' }}>
              {loading ? '...' : credits !== null ? credits : '0'}
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>
                Credits Available
              </h2>
              <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                For comic and voice generation
              </p>
              <div className="mt-2 flex gap-4 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                <span>1 credit per panel</span>
                <span>•</span>
                <span>2 credits per voice scene</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => router.push('/protected/credits')}
            className="px-6 py-3 rounded-lg font-semibold transition-all hover:opacity-90"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--foreground-on-accent)'
            }}
          >
            Purchase Credits
          </button>
        </div>
      </div>

      <div className="p-6 rounded-lg border" style={{ backgroundColor: 'var(--background-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
            <span className="text-2xl font-bold" style={{ color: 'var(--foreground-on-accent)' }}>
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Account Information</h2>
            <p style={{ color: 'var(--foreground-secondary)' }}>{user?.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
              Email Address
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-3 py-2 border rounded-md"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--background-secondary)',
                color: 'var(--foreground-secondary)'
              }}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
              Member Since
            </label>
            <input
              type="text"
              value={user?.user_metadata?.created_at ? new Date(user.user_metadata.created_at as string).toLocaleDateString() : 'Unknown'}
              disabled
              className="w-full px-3 py-2 border rounded-md"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--background-secondary)',
                color: 'var(--foreground-secondary)'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
