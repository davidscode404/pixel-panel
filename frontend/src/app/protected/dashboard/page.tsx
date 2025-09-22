'use client'

import { useAuth } from '@/components/auth/AuthProvider'

export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-amber-50 mb-2">Dashboard</h1>
        <p className="text-stone-300">Welcome back, {user?.email}!</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-stone-800/50 p-6 rounded-lg border border-stone-700">
          <h3 className="text-xl font-semibold text-amber-50 mb-2">Create Comic</h3>
          <p className="text-stone-300 mb-4">Start creating your AI-powered comic</p>
          <a href="/protected/create" className="text-amber-400 hover:text-amber-300">
            Get Started →
          </a>
        </div>
        
        <div className="bg-stone-800/50 p-6 rounded-lg border border-stone-700">
          <h3 className="text-xl font-semibold text-amber-50 mb-2">My Comics</h3>
          <p className="text-stone-300 mb-4">View your saved comics</p>
          <a href="/protected/comics" className="text-amber-400 hover:text-amber-300">
            View All →
          </a>
        </div>
        
        <div className="bg-stone-800/50 p-6 rounded-lg border border-stone-700">
          <h3 className="text-xl font-semibold text-amber-50 mb-2">Explore</h3>
          <p className="text-stone-300 mb-4">Discover comics from the community</p>
          <a href="/protected/explore" className="text-amber-400 hover:text-amber-300">
            Explore →
          </a>
        </div>
      </div>
    </div>
  )
}
