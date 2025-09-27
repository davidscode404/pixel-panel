'use client'

import { useAuth } from '@/components/auth/AuthProvider'

export default function ExplorePage() {
  const { user } = useAuth()

  return (
    <div className="w-full h-full px-2">
      <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-3 gap-4 space-y-4 w-full">
        {[...Array(24)].map((_, i) => {
          const index = i + 1
          // Create varying heights for comic-like layout - made taller for wider cards
          const heights = ['h-64', 'h-80', 'h-72', 'h-96', 'h-56', 'h-[400px]']
          const randomHeight = heights[index % heights.length]

          return (
            <div 
              key={index} 
              className={`group bg-stone-800/50 rounded-lg border border-stone-700/50 overflow-hidden hover:border-amber-500/50 transition-colors relative break-inside-avoid mb-4 ${randomHeight}`}
            >
              <div className="w-full h-full bg-gradient-to-br from-stone-600 to-stone-700 flex items-center justify-center">
                <span className="text-stone-400 text-xs">Comic {index}</span>
              </div>
              {/* Details overlay - only visible on hover */}
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                <h3 className="text-sm font-semibold text-amber-50 mb-1">Sample Comic {index}</h3>
                <p className="text-stone-300 text-xs mb-1">By Creator Name</p>
                <div className="flex items-center justify-between">
                  <span className="text-stone-400 text-xs">2 days ago</span>
                  <div className="flex items-center space-x-1">
                    <svg className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="text-stone-400 text-xs">4.5</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
