'use client'

import { useAuth } from '@/components/auth/AuthProvider'

export default function ProfilePage() {
  const { user } = useAuth()

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>Profile</h1>
        <p style={{ color: 'var(--foreground-secondary)' }}>Manage your account settings</p>
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
              value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
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
