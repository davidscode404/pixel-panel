'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { buildApiUrl, API_CONFIG } from '@/config/api'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function ProfilePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [userName, setUserName] = useState<string>('')
  const [isEditingName, setIsEditingName] = useState(false)
  const [tempName, setTempName] = useState('')
  const [isUpdatingName, setIsUpdatingName] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchUserProfile = useCallback(async () => {
    try {
      setLoading(true);
      
      // Check cache first
      const cachedName = localStorage.getItem('userDisplayName');
      if (cachedName) {
        setUserName(cachedName);
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session found');
      }

      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.USER_PROFILE), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      console.log('Fetched profile data:', data);
      const name = data.name || '';
      setUserName(name);
      
      // Cache the name
      if (name) {
        localStorage.setItem('userDisplayName', name);
      } else {
        localStorage.removeItem('userDisplayName');
      }
    } catch (error) {
      setUserName('');
    } finally {
      setLoading(false);
    }
  }, [])

  const updateUserName = async () => {
    if (!tempName.trim()) return;
    
    setIsUpdatingName(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session found');
      }

      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.USER_PROFILE), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: tempName.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to update name');
      }

      const newName = tempName.trim();
      setUserName(newName);
      setIsEditingName(false);
      setTempName('');
      
      // Update cache with new name
      localStorage.setItem('userDisplayName', newName);
    } catch (error) {
      console.error('Error updating name:', error);
      alert('Failed to update name. Please try again.');
    } finally {
      setIsUpdatingName(false);
    }
  }


  useEffect(() => {
    if (user) {
      fetchUserProfile()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  if (loading) {
    return <LoadingSpinner message="Loading profile..." fullPage />;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>Profile</h1>
        <p style={{ color: 'var(--foreground-secondary)' }}>Manage your account settings</p>
      </div>

      <div className="p-6 rounded-lg border" style={{ backgroundColor: 'transparent', borderColor: 'var(--border)' }}>
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
              Display Name
            </label>
            {isEditingName ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder="Enter your name"
                  className="flex-1 px-3 py-2 border rounded-md"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--background)',
                    color: 'var(--foreground)'
                  }}
                />
                <button
                  onClick={updateUserName}
                  disabled={isUpdatingName || !tempName.trim()}
                  className="px-4 py-2 rounded-md font-medium transition-colors"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--foreground-on-accent)',
                    opacity: isUpdatingName || !tempName.trim() ? 0.5 : 1
                  }}
                >
                  {isUpdatingName ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setIsEditingName(false);
                    setTempName('');
                  }}
                  className="px-4 py-2 rounded-md font-medium border transition-colors"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--background)',
                    color: 'var(--foreground)'
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="px-3 py-2 border rounded-md flex-1" style={{
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--background-secondary)',
                  color: userName ? 'var(--foreground)' : 'var(--foreground-secondary)'
                }}>
                  {userName || 'No name set'}
                </span>
                <button
                  onClick={() => {
                    setTempName(userName);
                    setIsEditingName(true);
                  }}
                  className="px-4 py-2 rounded-md font-medium border transition-colors"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--background)',
                    color: 'var(--foreground)'
                  }}
                >
                  Edit
                </button>
              </div>
            )}
          </div>
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
          
          
        </div>
      </div>
    </div>
  )
}