'use client'

import { useAuth } from '@/components/auth/AuthProvider'

export default function ExplorePage() {
  const { user } = useAuth()

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-amber-50 mb-2">Explore Comics</h1>
        <p className="text-stone-300">Discover amazing comics created by the community</p>
      </div>

      {/* Search and Filter Bar */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search comics..."
              className="w-full px-4 py-2 bg-stone-700 border border-stone-600 rounded-lg text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <select className="px-4 py-2 bg-stone-700 border border-stone-600 rounded-lg text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500">
            <option>All Categories</option>
            <option>Adventure</option>
            <option>Comedy</option>
            <option>Drama</option>
            <option>Fantasy</option>
            <option>Sci-Fi</option>
          </select>
        </div>
      </div>

      {/* Featured Comics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* Sample Comic Cards */}
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="bg-stone-800/50 rounded-lg border border-stone-700 overflow-hidden hover:border-amber-500/50 transition-colors">
            <div className="aspect-square bg-gradient-to-br from-stone-600 to-stone-700 flex items-center justify-center">
              <span className="text-stone-400 text-sm">Comic Preview</span>
            </div>
            <div className="p-4">
              <h3 className="text-lg font-semibold text-amber-50 mb-1">Sample Comic {i}</h3>
              <p className="text-stone-300 text-sm mb-2">By Creator Name</p>
              <div className="flex items-center justify-between">
                <span className="text-stone-400 text-xs">2 days ago</span>
                <div className="flex items-center space-x-1">
                  <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-stone-400 text-xs">4.5</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Load More Button */}
      <div className="text-center mt-8">
        <button className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
          Load More Comics
        </button>
      </div>
    </div>
  )
}
