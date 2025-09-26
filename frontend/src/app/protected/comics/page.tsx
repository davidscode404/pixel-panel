'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { Modal } from '@/components/ui/Modal'
import { buildApiUrl, API_CONFIG } from '@/config/api'

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
      console.log('🔍 DEBUG:getUser -> user:', userData?.user, 'error:', userErr);
      if (userData?.user) {
        const s2 = await supabase.auth.getSession();
        session = s2.data.session ?? null;
        console.log('🔍 DEBUG:getSession (after getUser) ->', session);
      }
    }

    if (!session) {
      console.log('❌ No active session available after retries');
      throw new Error('No active session. Please sign in first.');
    }

    if (!session.access_token) {
      console.log('❌ Session present but missing access_token');
      throw new Error('No access token available');
    }

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

  const deleteComic = async (comicId: string) => {
    if (!confirm('Are you sure you want to delete this comic? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('comics')
        .delete()
        .eq('id', comicId)

      if (error) throw error

      // Refresh the comics list
      fetchUserAndComics()
      
      // Close modal if the deleted comic was selected
      if (selectedComic?.id === comicId) {
        closeModal()
      }
    } catch (error) {
      console.error('Error deleting comic:', error)
      alert('Failed to delete comic. Please try again.')
    }
  }

  const togglePublicStatus = async (comic: Comic) => {
    try {
      const { error } = await supabase
        .from('comics')
        .update({ is_public: !comic.is_public })
        .eq('id', comic.id)

      if (error) throw error

      // Refresh the comics list
      fetchUserAndComics()
    } catch (error) {
      console.error('Error updating comic visibility:', error)
      alert('Failed to update comic visibility. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-amber-50 mb-2">My Comics ({comics.length})</h1>
            <p className="text-stone-300">Your personal comic collection</p>
          </div>
          <div className="flex items-center space-x-4">
            {comics.length > 0 && (
              <div className="text-sm text-gray-300">
                Total panels: {comics.reduce((total, comic) => total + comic.panels.length, 0)}
              </div>
            )}
            <button
              onClick={fetchUserAndComics}
              disabled={loading}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors disabled:opacity-50 text-sm"
            >
              {loading ? '🔄' : '↻'} Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <span className="text-red-400">⚠️</span>
              <span className="text-red-300">{error}</span>
            </div>
          </div>
        )}
      </div>

      {comics.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-6">📚</div>
          <div className="text-gray-300 text-xl mb-4">No comics created yet</div>
          <p className="text-gray-400 mb-6">Start creating your first comic story and see it appear here!</p>
          <a
            href="/protected/create"
            className="inline-block px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold rounded-lg transition-colors"
          >
            Create Your First Comic
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {comics.map((comic) => (
            <div
              key={comic.id}
              className="group bg-white/10 backdrop-blur-sm rounded-2xl p-4 hover:bg-white/15 transition-all duration-300 cursor-pointer border border-white/10 hover:border-white/20"
            >
              {/* Comic Preview - Show first panel */}
              {comic.panels && comic.panels.length > 0 && (
                <div className="relative mb-4" onClick={() => openModal(comic)}>
                  {imageLoading[`${comic.id}-preview`] && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50 rounded-lg">
                      <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    </div>
                  )}
                  {imageErrors[`${comic.id}-preview`] ? (
                    <div className="w-full h-48 bg-gray-800 rounded-lg flex items-center justify-center">
                      <div className="text-gray-400 text-center">
                        <div className="text-2xl mb-2">🖼️</div>
                        <div className="text-sm">Image not available</div>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={comic.panels[0].public_url}
                      alt={comic.title}
                      className="w-full h-48 object-cover rounded-lg"
                      onLoad={() => handleImageLoad(`${comic.id}-preview`)}
                      onError={() => handleImageError(`${comic.id}-preview`)}
                      onLoadStart={() => handleImageLoadStart(`${comic.id}-preview`)}
                    />
                  )}
                  <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    {comic.panels.length} panel{comic.panels.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )}

              {/* Comic Info */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1 group-hover:text-amber-300 transition-colors">
                    {comic.title}
                  </h3>
                  <p className="text-sm text-gray-400">
                    Created {new Date(comic.created_at).toLocaleDateString()}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        togglePublicStatus(comic)
                      }}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        comic.is_public
                          ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                          : 'bg-gray-500/20 text-gray-300 hover:bg-gray-500/30'
                      }`}
                    >
                      {comic.is_public ? '🌐 Public' : '🔒 Private'}
                    </button>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => openModal(comic)}
                      className="px-3 py-1 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded text-xs font-medium transition-colors"
                    >
                      👁️ View
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteComic(comic.id)
                      }}
                      className="px-3 py-1 bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded text-xs font-medium transition-colors"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for viewing comic details */}
      {showModal && selectedComic && (
        <Modal onClose={closeModal}>
          <div className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">{selectedComic.title}</h2>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  {selectedComic.panels.length} panel{selectedComic.panels.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={closeModal}
                  className="text-gray-500 hover:text-gray-700 text-xl font-bold"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
              {selectedComic.panels.map((panel) => (
                <div key={panel.id} className="bg-gray-50 rounded-lg overflow-hidden">
                  <div className="relative">
                    {imageLoading[`${selectedComic.id}-${panel.id}`] && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                        <div className="w-6 h-6 border-2 border-gray-400 border-t-gray-600 rounded-full animate-spin"></div>
                      </div>
                    )}
                    {imageErrors[`${selectedComic.id}-${panel.id}`] ? (
                      <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                        <div className="text-gray-500 text-center">
                          <div className="text-2xl mb-2">🖼️</div>
                          <div className="text-sm">Image not available</div>
                        </div>
                      </div>
                    ) : (
                      <img
                        src={panel.public_url}
                        alt={`Panel ${panel.panel_number}`}
                        className="w-full h-48 object-contain bg-white"
                        onLoad={() => handleImageLoad(`${selectedComic.id}-${panel.id}`)}
                        onError={() => handleImageError(`${selectedComic.id}-${panel.id}`)}
                        onLoadStart={() => handleImageLoadStart(`${selectedComic.id}-${panel.id}`)}
                      />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-gray-700 text-sm font-medium mb-1">Panel {panel.panel_number}</p>
                    <p className="text-gray-500 text-xs">
                      {(panel.file_size / 1024).toFixed(1)} KB • {new Date(panel.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
