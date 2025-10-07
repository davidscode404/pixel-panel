'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { buildApiUrl, API_CONFIG } from '@/config/api'
import Image from 'next/image'
import ComicDetailModal from '@/components/ComicDetailModal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { Comic, ComicPanel } from '@/types'

export default function MyComicsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [comics, setComics] = useState<Comic[]>([])
  const [loading, setLoading] = useState(true)
  const [imageLoading, setImageLoading] = useState<{ [key: string]: boolean }>({})
  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>({})
  const [error, setError] = useState<string | null>(null)
  const [selectedComic, setSelectedComic] = useState<Comic | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [autoPlay, setAutoPlay] = useState(false)
  const isLoadingRef = useRef(false)

  const supabase = createClient()

  // Function to get the session token for API requests
  const getAccessToken = async () => {
    let { data: { session }, error } = await supabase.auth.getSession();

    if (!session) {
      const refreshRes = await supabase.auth.refreshSession();
      session = refreshRes.data.session ?? null;
    }

    if (!session) {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userData?.user && !userErr) {
        // If getUser succeeds, try getSession one more time
        const { data: { session: finalSession } } = await supabase.auth.getSession();
        session = finalSession;
      }
    }

    if (!session?.access_token) {
      throw new Error('No valid session found');
    }

    return session.access_token;
  };

  const fetchUserAndComics = async () => {
    if (isLoadingRef.current) return; // Prevent duplicate calls
    
    try {
      isLoadingRef.current = true;
      setLoading(true);
      
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
          panels: (comic.comic_panels || []).sort((a: ComicPanel, b: ComicPanel) => a.panel_number - b.panel_number)
        }));
        
        setComics(transformedComics);
      }
    } catch (error) {
      // Error loading comics
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
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

  const openModal = (comic: Comic) => {
    setSelectedComic(comic);
    setAutoPlay(false);
    setShowModal(true);
  };

  const openModalAndPlay = (comic: Comic, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent the card click from firing
    setSelectedComic(comic);
    setAutoPlay(true);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedComic(null);
    setAutoPlay(false);
  };

  const handleComicUpdated = (updatedComic: Comic) => {
    setComics(prev => prev.map(comic => 
      comic.id === updatedComic.id ? updatedComic : comic
    ));
    setSelectedComic(updatedComic);
  };

  const handleComicDeleted = () => {
    // Refresh the comics list after deletion
    isLoadingRef.current = false; // Reset the loading flag to allow refresh
    fetchUserAndComics();
  };


  if (loading) {
    return <LoadingSpinner message="Loading your comics..." fullPage />;
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--error)' }}>Error Loading Comics</h2>
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
    <div className="w-full h-full overflow-auto scrollbar-hide">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>My Comics</h1>
          <p style={{ color: 'var(--foreground-secondary)' }}>
            {comics.length === 0 ? 'No comics yet' : `${comics.length} comic${comics.length !== 1 ? 's' : ''} created`}
          </p>
        </div>

        {comics.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>No Comics Yet</h2>
              <p className="mb-6" style={{ color: 'var(--foreground-secondary)' }}>Start creating your first comic story! Let your imagination run wild and bring your ideas to life.</p>
              <a
                href="/app/create"
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
          <div className="columns-2 md:columns-5 lg:columns-5 xl:columns-5 gap-6 space-y-6 w-full">
            {comics.map((comic, index) => {

              return (
              <div
                key={comic.id}
                className="group relative bg-background-card overflow-hidden cursor-pointer hover:ring-2 hover:ring-accent transition-all duration-200 hover:scale-[1.02] border-4 border-black"
                onClick={() => openModal(comic)}
              >
                {/* Image */}
                <div className="relative w-full aspect-[3/4]">
                  {imageLoading[`${comic.id}-preview`] && (
                    <div className="absolute inset-0 bg-background-tertiary flex items-center justify-center z-10">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
                    </div>
                  )}
                  {imageErrors[`${comic.id}-preview`] ? (
                    <div className="w-full h-full bg-background-tertiary flex items-center justify-center">
                      <div className="text-foreground-muted text-center">
                        <div className="text-sm">No image</div>
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
                          <Image
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

                  {/* Play button overlay - only show if comic has audio */}
                  {comic.panels.some(p => p.audio_url && p.panel_number > 0) && (
                    <div className="absolute top-3 right-3">
                      <button
                        onClick={(e) => openModalAndPlay(comic, e)}
                        className="bg-accent hover:bg-accent-hover text-white rounded-full p-2 transition-all duration-200 hover:scale-110 shadow-lg"
                        aria-label="Play comic"
                        title="Play comic with audio"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </button>
                    </div>
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

        {/* Modal for viewing comic details */}
        {selectedComic && (
          <ComicDetailModal
            comic={selectedComic}
            isOpen={showModal}
            onClose={closeModal}
            showVisibilityToggle={true}
            showEditButton={true}
            showDeleteButton={true}
            onDelete={handleComicDeleted}
            autoPlay={autoPlay}
            onComicUpdated={handleComicUpdated}
          />
        )}
      </div>
    </div>
  )
}
