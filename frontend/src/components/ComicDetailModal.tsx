'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import Image from 'next/image'

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
}

export default function ComicDetailModal({ comic, isOpen, onClose }: ComicDetailModalProps) {
  const [imageLoading, setImageLoading] = useState<{ [key: string]: boolean }>({})
  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>({})
  const [playingAudio, setPlayingAudio] = useState<string | null>(null)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  const [currentPlayingPanel, setCurrentPlayingPanel] = useState<number | null>(null)

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
        <div className="flex justify-between items-center mb-6">
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
          <button
            onClick={handleClose}
            className="text-foreground-muted hover:text-foreground text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {comic.panels
            .filter(panel => panel.panel_number > 0)
            .sort((a, b) => a.panel_number - b.panel_number)
            .map((panel) => {
              const isCurrentlyPlaying = currentPlayingPanel === panel.panel_number;
              return (
              <div
                key={panel.id}
                className="bg-background-tertiary rounded-lg overflow-hidden transition-all duration-300 relative"
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
                      <div className={`absolute bottom-0 left-0 right-0 backdrop-blur-sm px-3 py-2 rounded-b-lg transition-all duration-300 ${
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
