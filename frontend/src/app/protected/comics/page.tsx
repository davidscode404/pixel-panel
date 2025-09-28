'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { Modal } from '@/components/ui/Modal'
import { buildApiUrl, API_CONFIG } from '@/config/api'
import Image from 'next/image'

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
  const [user, setUser] = useState<User | null>(null)
  const [comics, setComics] = useState<Comic[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedComic, setSelectedComic] = useState<Comic | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [imageLoading, setImageLoading] = useState<{ [key: string]: boolean }>({})
  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>({})
  const [error, setError] = useState<string | null>(null)

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
      setError(null)
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
      setError('An error occurred while loading your comics.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUserAndComics()
  }, [])

  const openModal = (comic: Comic) => {
    setSelectedComic(comic)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedComic(null)
  }

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-foreground-secondary">Loading your comics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-error text-xl mb-4">⚠️</div>
          <p className="text-error mb-4">{error}</p>
          <button 
            onClick={fetchUserAndComics}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-foreground-inverse rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">My Comics</h1>
          <p className="text-foreground-secondary">
            {comics.length === 0 ? 'No comics yet' : `${comics.length} comic${comics.length !== 1 ? 's' : ''} created`}
          </p>
        </div>

        {comics.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📚</div>
            <h2 className="text-2xl font-bold text-foreground mb-4">No Comics Yet</h2>
            <p className="text-foreground-secondary mb-8 max-w-md mx-auto">
              Start creating your first comic story! Let your imagination run wild and bring your ideas to life.
            </p>
            <a
              href="/protected/create"
              className="inline-block px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold rounded-lg transition-colors"
            >
              Create Your First Comic
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {comics.map((comic) => {
              console.log('Rendering comic:', comic.title, 'Panels:', comic.panels?.length || 0);
              return (
              <div 
                key={comic.id} 
                className="group relative bg-background-card rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-accent transition-all duration-200 hover:scale-[1.02] border-2 border-black shadow-lg"
                onClick={() => openModal(comic)}
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
                     <Image
                        src={
                          comic.panels.find(p => p.panel_number === 0)?.public_url || 
                          comic.panels.find(p => p.panel_number === 1)?.public_url ||
                          comic.panels[0]?.public_url ||
                          '/placeholder-comic.png'
                        }
                        alt={comic.title}
                        width={400}
                        height={300}
                        className="w-full h-full object-cover"
                        onLoad={() => handleImageLoad(`${comic.id}-preview`)}
                        onError={() => handleImageError(`${comic.id}-preview`)}
                        onLoadStart={() => handleImageLoadStart(`${comic.id}-preview`)}
                      />
                  )}
                </div>

                {/* Title and date at bottom with overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-3">
                  <h3 className="text-white font-semibold text-sm mb-1 line-clamp-2 leading-tight">{comic.title}</h3>
                  <p className="text-foreground-secondary text-xs">
                    {new Date(comic.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </p>
                </div>

              </div>
              );
            })}
          </div>
        )}

        {/* Modal for viewing comic details */}
        {showModal && selectedComic && (
          <Modal onClose={closeModal}>
            <div className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-foreground">{selectedComic.title}</h2>
                <button
                  onClick={closeModal}
                  className="text-foreground-muted hover:text-foreground text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedComic.panels
                  .filter(panel => panel.panel_number > 0)
                  .sort((a, b) => a.panel_number - b.panel_number)
                  .map((panel) => (
                  <div key={panel.id} className="bg-background-tertiary rounded-lg overflow-hidden border-2 border-black shadow-lg">
                    {imageErrors[`${selectedComic.id}-${panel.id}`] ? (
                      <div className="w-full h-48 bg-background-secondary flex items-center justify-center">
                        <div className="text-foreground-muted text-center">
                          <div className="text-2xl mb-2">🖼️</div>
                          <div className="text-sm">Image not available</div>
                        </div>
                      </div>
                    ) : (
                       <Image
                          src={panel.public_url}
                          alt={`Panel ${panel.panel_number}`}
                          width={400}
                          height={192}
                          className="w-full h-48 object-contain bg-white"
                          onLoad={() => handleImageLoad(`${selectedComic.id}-${panel.id}`)}
                          onError={() => handleImageError(`${selectedComic.id}-${panel.id}`)}
                          onLoadStart={() => handleImageLoadStart(`${selectedComic.id}-${panel.id}`)}
                        />
                    )}
                    <div className="p-3">
                      <p className="text-foreground text-sm font-medium">Panel {panel.panel_number}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 pt-4 border-t border-border">
                <div className="text-center text-sm text-foreground-secondary">
                  <span>Created: {new Date(selectedComic.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                </div>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  )
}
