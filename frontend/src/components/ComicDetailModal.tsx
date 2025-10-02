'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { buildApiUrl, API_CONFIG } from '@/config/api'

interface Panel {
  id: string
  comic_id?: string
  panel_number: number
  storage_path?: string
  public_url: string
  file_size?: number
  created_at?: string
  narration?: string
  audio_url?: string
}

interface Comic {
  id: string
  title: string
  user_id?: string
  is_public?: boolean
  created_at: string
  updated_at?: string
  panels: Panel[]
}

interface ComicDetailModalProps {
  comic: Comic
  isOpen: boolean
  onClose: () => void
  showVisibilityToggle?: boolean
  showEditButton?: boolean
}

export default function ComicDetailModal({ comic, isOpen, onClose, showVisibilityToggle = false, showEditButton = false }: ComicDetailModalProps) {
  const [imageLoading, setImageLoading] = useState<{ [key: string]: boolean }>({})
  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>({})
  const [playingAudio, setPlayingAudio] = useState<string | null>(null)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  const [currentPlayingPanel, setCurrentPlayingPanel] = useState<number | null>(null)
  const [isPublic, setIsPublic] = useState(comic.is_public ?? false)
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false)

  // Check if comic can be published (has title, narrations, and thumbnail)
  const canPublish = () => {
    const hasTitle = comic.title && comic.title.trim().length > 0
    const hasNarrations = comic.panels
      .filter(panel => panel.panel_number > 0) // Exclude panel 0 (thumbnail)
      .every(panel => panel.narration && panel.narration.trim().length > 0)
    const hasThumbnail = comic.panels.some(panel => panel.panel_number === 0) // Panel 0 is thumbnail
    
    return hasTitle && hasNarrations && hasThumbnail
  }

  // Get publication requirements status
  const getPublicationStatus = () => {
    const hasTitle = comic.title && comic.title.trim().length > 0
    const storyPanels = comic.panels.filter(panel => panel.panel_number > 0)
    const panelsWithNarrations = storyPanels.filter(panel => panel.narration && panel.narration.trim().length > 0)
    const hasThumbnail = comic.panels.some(panel => panel.panel_number === 0)
    
    return {
      hasTitle,
      hasThumbnail,
      totalStoryPanels: storyPanels.length,
      panelsWithNarrations: panelsWithNarrations.length,
      hasAllNarrations: panelsWithNarrations.length === storyPanels.length && storyPanels.length > 0
    }
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

  const stopAudio = () => {
    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
      setAudioElement(null)
    }
    setPlayingAudio(null)
    setCurrentPlayingPanel(null)
  }

  const playComicSequentially = (comic: Comic) => {
    // Stop any currently playing audio
    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
    }

    // If already playing this comic, stop it
    if (playingAudio === `comic-${comic.id}`) {
      setPlayingAudio(null)
      setAudioElement(null)
      setCurrentPlayingPanel(null)
      return
    }

    // Get panels with audio, sorted by panel number, excluding panel 0 (composite)
    const panelsWithAudio = comic.panels
      .filter(p => p.audio_url && p.panel_number > 0)
      .sort((a, b) => a.panel_number - b.panel_number)

    if (panelsWithAudio.length === 0) {
      console.log('No panels with audio found')
      return
    }

    let currentIndex = 0

    const playNextPanel = () => {
      if (currentIndex >= panelsWithAudio.length) {
        // All panels played
        setPlayingAudio(null)
        setAudioElement(null)
        setCurrentPlayingPanel(null)
        return
      }

      const panel = panelsWithAudio[currentIndex]
      setCurrentPlayingPanel(panel.panel_number)

      const audio = new Audio(panel.audio_url!)
      setAudioElement(audio)
      setPlayingAudio(`comic-${comic.id}`)

      audio.onended = () => {
        currentIndex++
        playNextPanel()
      }

      audio.onerror = (e) => {
        console.error(`Error playing audio for panel ${panel.panel_number}:`, e)
        currentIndex++
        playNextPanel()
      }

      audio.play().catch(err => {
        console.error('Error playing audio:', err)
        currentIndex++
        playNextPanel()
      })
    }

    playNextPanel()
  }

  const handleClose = () => {
    stopAudio()
    onClose()
  }

  const toggleVisibility = async () => {
    setIsUpdatingVisibility(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(buildApiUrl(`/api/comics/${comic.id}/visibility`), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_public: !isPublic })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.detail || 'Failed to update visibility'
        throw new Error(errorMessage)
      }

      setIsPublic(!isPublic)
    } catch (error) {
      console.error('Error updating comic visibility:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to update comic visibility'
      alert(errorMessage)
    } finally {
      setIsUpdatingVisibility(false)
    }
  }

  // Sync isPublic state when comic changes
  useEffect(() => {
    setIsPublic(comic.is_public ?? false)
  }, [comic.id, comic.is_public])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause()
        audioElement.currentTime = 0
      }
    }
  }, [audioElement])

  if (!isOpen) return null

  return (
    <Modal onClose={handleClose}>
      <div className="max-w-4xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-start mb-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {comic.panels.some(p => p.audio_url && p.panel_number > 0) && (
                <button
                  onClick={() => playComicSequentially(comic)}
                  className="bg-accent hover:bg-accent-hover text-white rounded-full p-2 transition-all duration-200 hover:scale-110"
                  aria-label={playingAudio === `comic-${comic.id}` ? "Stop playback" : "Play comic"}
                >
                  {playingAudio === `comic-${comic.id}` ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
              )}
              <h2 className="text-2xl font-bold text-foreground">{comic.title}</h2>
            </div>

            {/* Public/Private Toggle and Edit Button - only show for user's own comics */}
            <div className="flex items-center gap-2">
              {showVisibilityToggle && (
                <button
                  onClick={toggleVisibility}
                  disabled={isUpdatingVisibility || (!isPublic && !canPublish())}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors self-start ${
                    isPublic
                      ? 'bg-green-500/20 text-green-600 hover:bg-green-500/30'
                      : canPublish()
                        ? 'bg-gray-500/20 text-gray-600 hover:bg-gray-500/30'
                        : 'bg-red-500/20 text-red-600 opacity-50 cursor-not-allowed'
                  } ${isUpdatingVisibility ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={
                    !isPublic && !canPublish()
                      ? "Cannot publish: Missing title, narrations, or thumbnail"
                      : isUpdatingVisibility
                        ? "Updating visibility..."
                        : isPublic
                          ? "Make private"
                          : "Make public"
                  }
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    {isPublic ? (
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    ) : (
                      <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.804 11.804 0 001 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                    )}
                  </svg>
                  <span>
                    {isPublic 
                      ? 'Public' 
                      : canPublish() 
                        ? 'Private' 
                        : 'Private (Incomplete)'
                    }
                  </span>
                </button>
              )}

              {showEditButton && (
                <button
                  disabled
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors self-start bg-gray-500/20 text-gray-600 opacity-50 cursor-not-allowed"
                  title="Edit functionality coming soon"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                  </svg>
                  <span>Edit</span>
                </button>
              )}
            </div>
          </div>

          <button
            onClick={handleClose}
            className="text-foreground-muted hover:text-foreground text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Publication Requirements Indicator - only show for user's own comics when not public */}
        {showVisibilityToggle && !isPublic && (
          <div className="mb-4 p-3 bg-background-tertiary rounded-lg border border-border">
            <h3 className="text-sm font-medium text-foreground mb-2">Publication Requirements</h3>
            <div className="space-y-1">
              {(() => {
                const status = getPublicationStatus()
                return (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <div className={`w-2 h-2 rounded-full ${status.hasTitle ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className={status.hasTitle ? 'text-green-600' : 'text-red-600'}>
                        {status.hasTitle ? '✓' : '✗'} Comic Title
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className={`w-2 h-2 rounded-full ${status.hasThumbnail ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className={status.hasThumbnail ? 'text-green-600' : 'text-red-600'}>
                        {status.hasThumbnail ? '✓' : '✗'} Thumbnail (Panel 0)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className={`w-2 h-2 rounded-full ${status.hasAllNarrations ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className={status.hasAllNarrations ? 'text-green-600' : 'text-red-600'}>
                        {status.hasAllNarrations ? '✓' : '✗'} Panel Narrations ({status.panelsWithNarrations}/{status.totalStoryPanels})
                      </span>
                    </div>
                  </>
                )
              })()}
            </div>
            {!canPublish() && (
              <div className="mt-2 text-xs text-foreground-muted">
                Complete all requirements above to publish your comic.
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {comic.panels
            .filter(panel => panel.panel_number > 0)
            .sort((a, b) => a.panel_number - b.panel_number)
            .map((panel) => {
              const isCurrentlyPlaying = currentPlayingPanel === panel.panel_number;
              return (
              <div
                key={panel.id}
                className="bg-background-tertiary overflow-hidden transition-all duration-300 relative border-4 border-black"
              >
                {imageErrors[`${comic.id}-${panel.id}`] ? (
                  <div className="w-full h-48 bg-background-secondary flex items-center justify-center">
                    <div className="text-foreground-muted text-center">
                      <div className="text-2xl mb-2">🖼️</div>
                      <div className="text-sm">Image not available</div>
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full h-full">
                    <Image
                      src={panel.public_url}
                      alt={`Panel ${panel.panel_number}`}
                      width={400}
                      height={192}
                      className="w-full h-full object-cover bg-white"
                      onLoad={() => handleImageLoad(`${comic.id}-${panel.id}`)}
                      onError={() => handleImageError(`${comic.id}-${panel.id}`)}
                      onLoadStart={() => handleImageLoadStart(`${comic.id}-${panel.id}`)}
                    />
                    {panel.narration && (
                      <div className={`absolute bottom-0 left-0 right-0 backdrop-blur-sm px-3 py-2 transition-all duration-300 ${
                        isCurrentlyPlaying ? 'bg-accent ring-2 ring-accent' : 'bg-black/80'
                      }`}>
                        <p className="text-white text-sm italic leading-tight">{panel.narration}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              );
            })}
        </div>
      </div>
    </Modal>
  )
}
