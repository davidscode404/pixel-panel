'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { buildApiUrl, API_CONFIG } from '@/config/api'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

interface Panel {
  id: string
  comic_id: string
  panel_number: number
  storage_path: string
  public_url: string
  file_size: number
  created_at: string
}

interface Comic {
  id: string
  title: string
  user_id: string
  is_public: boolean
  created_at: string
  updated_at: string
  panels: Panel[]
}

export default function MyComicsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [comics, setComics] = useState<Comic[]>([])
  const [loading, setLoading] = useState(true)
  const [imageLoading, setImageLoading] = useState<{ [key: string]: boolean }>({})
  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>({})
  const [error] = useState<string | null>(null)

  const supabase = createClient()

  // Function to get the session token for API requests
  const getAccessToken = async () => {
    let { data: { session }, error } = await supabase.auth.getSession();
    console.log('🔍 DEBUG:getSession -> session:', session, 'error:', error);

    if (!session) {
      console.log('ℹ️ No session returned. Attempting refreshSession...');
      const refreshRes = await supabase.auth.refreshSession();
      console.log('🔍 DEBUG:refreshSession ->', refreshRes);
      session = refreshRes.data.session ?? null;
    }

    if (!session) {
      console.log('ℹ️ No session after refresh. Attempting getUser as fallback...');
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      console.log('🔍 DEBUG:getUser ->', userData, userErr);
      if (userData?.user && !userErr) {
        // If getUser succeeds, try getSession one more time
        const { data: { session: finalSession } } = await supabase.auth.getSession();
        session = finalSession;
      }
    }

    if (!session?.access_token) {
      throw new Error('No valid session found');
    }

    console.log('✅ Successfully obtained access token');
    return session.access_token;
  };

  const fetchUserAndComics = async () => {
    try {
      // Clear any previous errors
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      
      setUser(user)

      if (user) {
        // Get access token for API request
        const accessToken = await getAccessToken();
        
        // Fetch user's comics from backend API
        const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.USER_COMICS), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch comics: ${response.status}`);
        }

        const data = await response.json();
        
        // Transform the data to match our interface
        const transformedComics = (data.comics || []).map((comic: any) => ({
          ...comic,
          panels: (comic.comic_panels || []).sort((a: Panel, b: Panel) => a.panel_number - b.panel_number)
        }));
        
        setComics(transformedComics);
      }
    } catch (error) {
      console.error('Error:', error)
      console.error('Error loading comics:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUserAndComics()
  }, [])


  const handleImageLoad = (imageId: string) => {
    setImageLoading(prev => ({ ...prev, [imageId]: false }))
  }

  const handleImageError = (imageId: string) => {
    setImageLoading(prev => ({ ...prev, [imageId]: false }))
    setImageErrors(prev => ({ ...prev, [imageId]: true }))
  }

  const handleImageLoadStart = (imageId: string) => {
    setImageLoading(prev => ({ ...prev, [imageId]: true }))
    setImageErrors(prev => ({ ...prev, [imageId]: false }))
  }

  const formatComicTitle = (title: string | undefined): string => {
    if (!title) return 'Unknown Comic';
    return title
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };


  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--accent)' }}></div>
          <p style={{ color: 'var(--foreground)' }}>Loading your comics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4" style={{ color: 'var(--error)' }}>⚠️</div>
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>Error Loading Comics</h2>
          <p className="mb-6" style={{ color: 'var(--foreground-secondary)' }}>{error}</p>
          <button 
            onClick={fetchUserAndComics}
            className="px-6 py-3 rounded-lg transition-colors"
            style={{ 
              backgroundColor: 'var(--accent)',
              color: 'var(--foreground-inverse)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent)'
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full px-2">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>My Comics</h1>
          <p style={{ color: 'var(--foreground-secondary)' }}>
            {comics.length === 0 ? 'No comics yet' : `${comics.length} comic${comics.length !== 1 ? 's' : ''} created`}
          </p>
        </div>

        {comics.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4" style={{ color: 'var(--accent)' }}>📖</div>
              <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>No Comics Yet</h2>
              <p className="mb-6" style={{ color: 'var(--foreground-secondary)' }}>Start creating your first comic story! Let your imagination run wild and bring your ideas to life.</p>
              <a
                href="/protected/create"
                className="inline-block px-6 py-3 rounded-lg transition-colors"
                style={{ 
                  backgroundColor: 'var(--accent)',
                  color: 'var(--foreground-inverse)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--accent-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--accent)'
                }}
              >
                Create Your First Comic
              </a>
            </div>
          </div>
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-1 space-y-1 w-full">
            {comics.map((comic, index) => {
              console.log('Rendering comic:', comic.title, 'Panels:', comic.panels?.length || 0);
              
              // Create varying heights for comic-like layout (same as explore page)
              const heights = ['h-48', 'h-64', 'h-56', 'h-72', 'h-40', 'h-80'];
              const randomHeight = heights[index % heights.length];
              
              return (
              <div 
                key={comic.id} 
                className={`group border overflow-hidden transition-colors relative break-inside-avoid mb-1 ${randomHeight} cursor-pointer`}
                style={{
                  backgroundColor: 'var(--background-card)',
                  borderColor: 'var(--border)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
                onClick={() => router.push(`/preview/${comic.id}`)}
              >
                {/* Image */}
                <div className="relative w-full aspect-[4/3]">
                  {imageLoading[`${comic.id}-preview`] && (
                    <div className="absolute inset-0 bg-background-tertiary flex items-center justify-center z-10">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
                    </div>
                  )}
                  {imageErrors[`${comic.id}-preview`] ? (
                    <div className="w-full h-full bg-background-tertiary flex items-center justify-center">
                      <div className="text-foreground-muted text-center">
                        <div className="text-xl mb-1">🖼️</div>
                        <div className="text-xs">No image</div>
                      </div>
                    </div>
                  ) : (
                    (() => {
                      const imageUrl = comic.panels.find(p => p.panel_number === 0)?.public_url || 
                                      comic.panels.find(p => p.panel_number === 1)?.public_url ||
                                      comic.panels[0]?.public_url ||
                                      '/placeholder-comic.png';
                      
                      if (imageUrl.startsWith('http')) {
                        return (
                          <Image
                            src={imageUrl}
                            alt={formatComicTitle(comic.title)}
                            width={400}
                            height={300}
                            className="w-full h-full object-cover"
                            onLoad={() => handleImageLoad(`${comic.id}-preview`)}
                            onError={() => handleImageError(`${comic.id}-preview`)}
                            onLoadStart={() => handleImageLoadStart(`${comic.id}-preview`)}
                          />
                        );
                      } else {
                        return (
                          <img
                            src={imageUrl}
                            alt={formatComicTitle(comic.title)}
                            className="w-full h-full object-cover"
                            onLoad={() => handleImageLoad(`${comic.id}-preview`)}
                            onError={() => handleImageError(`${comic.id}-preview`)}
                            onLoadStart={() => handleImageLoadStart(`${comic.id}-preview`)}
                          />
                        );
                      }
                    })()
                  )}
                </div>

                {/* Title and date at bottom with overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-3">
                  <h3 className="text-white font-semibold text-sm mb-1 line-clamp-2 leading-tight">{formatComicTitle(comic.title)}</h3>
                  <p className="text-foreground-secondary text-xs">
                    {new Date(comic.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </p>
                </div>

              </div>
              );
            })}
          </div>
        )}


      </div>
    </div>
  )
}
