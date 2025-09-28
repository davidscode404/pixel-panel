'use client'

import { useAuth } from '@/components/auth/AuthProvider'

export default function ProfilePage() {
  const { user } = useAuth()

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Profile</h1>
        <p className="text-foreground-secondary">Manage your account settings</p>
      </div>

      <div className="bg-background-card p-6 rounded-lg border border-border">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center">
            <span className="text-white text-2xl font-bold">
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Account Information</h2>
            <p className="text-foreground-secondary">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-3 py-2 border border-border rounded-md bg-background-secondary text-foreground"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-2">
              Member Since
            </label>
            <input
              type="text"
              value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
              disabled
              className="w-full px-3 py-2 border border-border rounded-md bg-background-secondary text-foreground"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
