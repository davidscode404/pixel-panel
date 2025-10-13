'use client'

import { useState, useEffect, useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { buildApiUrl } from '@/config/api'
import type { Comic, ComicPanel } from '@/types'

interface ComicDetailModalProps {
  comic: Comic
  isOpen: boolean
  onClose: () => void
  showVisibilityToggle?: boolean
  showEditButton?: boolean
  showDeleteButton?: boolean
  onDelete?: () => void
  autoPlay?: boolean
  onComicUpdated?: (updatedComic: Comic) => void
}

export default function ComicDetailModal({ comic, isOpen, onClose, showVisibilityToggle = false, showEditButton = false, showDeleteButton = false, onDelete, autoPlay = false, onComicUpdated }: ComicDetailModalProps) {
  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>({})
  const [playingAudio, setPlayingAudio] = useState<string | null>(null)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  const [currentPlayingPanel, setCurrentPlayingPanel] = useState<number | null>(null)
  const [isPublic, setIsPublic] = useState(comic.is_public ?? false)
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingPanel, setEditingPanel] = useState<ComicPanel | null>(null)
  const [editingNarration, setEditingNarration] = useState('')
  const [editingPrompt, setEditingPrompt] = useState('')
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [isUpdatingNarration, setIsUpdatingNarration] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showNarration, setShowNarration] = useState(true)
  const [selectedVoice, setSelectedVoice] = useState<string>('L1aJrPa7pLJEyYlh3Ilq')
  const [voiceSpeed, setVoiceSpeed] = useState<number>(1.0)
  const [regeneratingAllAudio, setRegeneratingAllAudio] = useState(false)

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

  const handleImageError = (imageId: string) => {
    setImageErrors(prev => ({ ...prev, [imageId]: true }))
  }

  const stopAudio = () => {
    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
      audioElement.onended = null
      audioElement.onerror = null
      setAudioElement(null)
    }
    setPlayingAudio(null)
    setCurrentPlayingPanel(null)
  }

  const playComicSequentially = useCallback((comic: Comic) => {
    // Stop any currently playing audio
    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
      audioElement.onended = null
      audioElement.onerror = null
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

      // Add cache-busting parameter to force fresh audio load
      const audioUrl = panel.audio_url!.includes('?') 
        ? `${panel.audio_url}&_cb=${Date.now()}`
        : `${panel.audio_url}?_cb=${Date.now()}`
      const audio = new Audio(audioUrl)
      
      // Set up event handlers before setting state
      audio.onended = () => {
        currentIndex++
        playNextPanel()
      }

      audio.onerror = () => {
        console.error('Audio playback error for panel:', panel.panel_number)
        currentIndex++
        playNextPanel()
      }

      // Set state after setting up handlers
      setAudioElement(audio)
      setPlayingAudio(`comic-${comic.id}`)

      // Play the audio
      audio.play().catch((error) => {
        console.error('Failed to play audio:', error)
        currentIndex++
        playNextPanel()
      })
    }

    playNextPanel()
  }, [audioElement, playingAudio])

  const handleClose = () => {
    stopAudio()
    onClose()
  }

  const handleEditComic = () => {
    setIsEditMode(true)
    setEditingPanel(null)
    setEditingNarration('')
    setEditingPrompt('')
  }

  const handleCancelEdit = () => {
    setIsEditMode(false)
    setEditingPanel(null)
    setEditingNarration('')
    setEditingPrompt('')
  }

  const handleEditPanel = (panel: ComicPanel) => {
    setEditingPanel(panel)
    setEditingNarration(panel.narration || '')
    setEditingPrompt(panel.prompt || '')
  }

  const handleSaveNarration = async () => {
    if (!editingPanel || !editingNarration.trim()) return

    setIsUpdatingNarration(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      // Update the panel narration in the database (without regenerating audio)
      const response = await fetch(buildApiUrl(`/api/comics/panels/${editingPanel.id}`), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          narration: editingNarration.trim(),
          regenerate_audio: false
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to update narration (${response.status})`)
      }

      const respJson = await response.json().catch(() => ({}))
      const newAudioUrl = respJson?.audio_url as string | undefined

      // Update local comic data
      const updatedComic = {
        ...comic,
        panels: comic.panels.map(p => 
          p.id === editingPanel.id 
            ? { 
                ...p, 
                narration: editingNarration.trim()
              }
            : p
        )
      }

      if (onComicUpdated) {
        onComicUpdated(updatedComic)
      }

      setEditingPanel(null)
      setEditingNarration('')
      setEditingPrompt('')
    } catch (error) {
      console.error('Error updating narration:', error)
      alert('Failed to update narration. Please try again.')
    } finally {
      setIsUpdatingNarration(false)
    }
  }

  const handleRegenerateAllAudio = async () => {
    setRegeneratingAllAudio(true)
    
    // Stop any currently playing audio
    stopAudio()
    
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const storyPanels = comic.panels
        .filter(p => p.panel_number > 0 && p.narration && p.narration.trim())
        .sort((a, b) => a.panel_number - b.panel_number)

      if (storyPanels.length === 0) {
        alert('No panels with narrations found')
        return
      }

      let successCount = 0
      const errors: string[] = []
      const updatedPanels: { [key: string]: string } = {}

      for (const panel of storyPanels) {
        try {
          const response = await fetch(buildApiUrl(`/api/comics/panels/${panel.id}`), {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              narration: panel.narration,
              voice_id: selectedVoice,
              speed: voiceSpeed,
              regenerate_audio: true
            })
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            errors.push(`Panel ${panel.panel_number}: ${errorData.detail || response.status}`)
            continue
          }

          const result = await response.json()
          if (result.audio_url) {
            console.log(`Panel ${panel.panel_number} new audio URL:`, result.audio_url)
            updatedPanels[panel.id] = result.audio_url
          } else {
            console.warn(`Panel ${panel.panel_number} - no audio URL returned`)
          }
          
          successCount++
        } catch (error) {
          errors.push(`Panel ${panel.panel_number}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      if (successCount > 0) {
        // Update the comic state with new audio URLs (without cache-busting in state)
        const updatedComic = {
          ...comic,
          panels: comic.panels.map(p => 
            updatedPanels[p.id] 
              ? { ...p, audio_url: updatedPanels[p.id] } 
              : p
          )
        }

        if (onComicUpdated) {
          onComicUpdated(updatedComic)
        }

        alert(`Successfully regenerated audio for ${successCount} panel(s)!${errors.length > 0 ? `\n\nSome errors:\n${errors.join('\n')}` : ''}`)
      } else {
        alert(`Failed to regenerate audio:\n${errors.join('\n')}`)
      }
    } catch (error) {
      console.error('Error regenerating all audio:', error)
      alert('Failed to regenerate audio. Please try again.')
    } finally {
      setRegeneratingAllAudio(false)
    }
  }

  const handleRegenerateImage = async () => {
    if (!editingPanel || !editingPrompt.trim()) return

    setIsGeneratingImage(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      // Get the previous panel for context
      // For panel 1, use thumbnail (panel 0) as context
      // For other panels, use the previous panel
      let previousPanel = null
      
      if (editingPanel.panel_number === 1) {
        // Panel 1 should use thumbnail (panel 0) for context
        previousPanel = comic.panels.find(p => p.panel_number === 0)
      } else if (editingPanel.panel_number > 1) {
        // Other panels use the previous story panel
        previousPanel = comic.panels
          .filter(p => p.panel_number > 0)
          .sort((a, b) => a.panel_number - b.panel_number)
          .find(p => p.panel_number === editingPanel.panel_number - 1)
      }

      // Prepare context from previous panel
      let previousPanelContext = null
      if (previousPanel) {
        previousPanelContext = {
          image_data: previousPanel.public_url,
          prompt: previousPanel.prompt || 'Comic book cover art'
        }
      }

      // Regenerate the panel image with the new prompt
      const response = await fetch(buildApiUrl(`/api/comics/panels/${editingPanel.id}/regenerate`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text_prompt: editingPrompt.trim(),
          previous_panel_context: previousPanelContext
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to regenerate image (${response.status})`)
      }

      const result = await response.json()
      
      // Add cache-busting parameter to force image reload
      const newImageUrl = result.public_url + `?t=${Date.now()}`
      
      // Update the panel with new image and prompt
      const updatedComic = {
        ...comic,
        panels: comic.panels.map(p => 
          p.id === editingPanel.id 
            ? { ...p, public_url: newImageUrl, prompt: editingPrompt.trim() }
            : p
        )
      }

      if (onComicUpdated) {
        onComicUpdated(updatedComic)
      }

      // Clear the editing state
      setEditingPanel(null)
      setEditingPrompt('')
    } catch (error) {
      console.error('Error regenerating image:', error)
      alert('Failed to regenerate image. Please try again.')
    } finally {
      setIsGeneratingImage(false)
    }
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to update comic visibility'
      alert(errorMessage)
    } finally {
      setIsUpdatingVisibility(false)
    }
  }

  const handleDeleteComic = async () => {
    if (!comic.id) return;
    
    try {
      setIsDeleting(true);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        alert('You must be logged in to delete comics');
        return;
      }

      const response = await fetch(buildApiUrl(`/api/comics/user-comics/${comic.id}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        alert('Comic deleted successfully!');
        setShowDeleteConfirm(false);
        onClose(); // Close the modal
        if (onDelete) {
          onDelete(); // Call the parent's delete callback to refresh the list
        }
      } else {
        const errorData = await response.json();
        alert(`Failed to delete comic: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting comic:', error);
      alert('Failed to delete comic. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }

  // Sync isPublic state when comic changes
  useEffect(() => {
    setIsPublic(comic.is_public ?? false)
  }, [comic.id, comic.is_public])

  // Reset playback state when comic panels change (e.g., after audio regeneration)
  useEffect(() => {
    // Stop any playing audio when audio URLs change to avoid playing old cached audio
    const hasAudioUrls = comic.panels.some(p => p.audio_url)
    if (hasAudioUrls && audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
      setAudioElement(null)
      setPlayingAudio(null)
      setCurrentPlayingPanel(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comic.panels.map(p => p.audio_url).join(',')])

  // Auto-play when modal opens with autoPlay enabled
  useEffect(() => {
    if (isOpen && autoPlay && comic.panels.some(p => p.audio_url && p.panel_number > 0)) {
      // Small delay to ensure modal is fully rendered
      const timer = setTimeout(() => {
        playComicSequentially(comic)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen, autoPlay, comic, playComicSequentially])

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
      <div className="max-w-4xl max-h-[90vh] overflow-y-auto p-6 scrollbar-hide">
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
              <button
                onClick={() => setShowNarration(!showNarration)}
                className={`rounded-full p-2 transition-all duration-200 hover:scale-110 ${
                  showNarration 
                    ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                    : 'bg-gray-500 hover:bg-gray-600 text-white'
                }`}
                aria-label={showNarration ? "Hide narration text" : "Show narration text"}
                title={showNarration ? "Hide narration text" : "Show narration text"}
              >
                {showNarration ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.804 11.804 0 001 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                  </svg>
                )}
              </button>
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
                        ? 'bg-orange-500/20 text-orange-600 hover:bg-orange-500/30'
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

              {showEditButton && !isEditMode && (
                <button
                  onClick={handleEditComic}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors self-start bg-orange-500/20 text-orange-600 hover:bg-orange-500/30"
                  title="Edit this comic"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                  </svg>
                  <span>Edit</span>
                </button>
              )}

              {showEditButton && isEditMode && (
                <button
                  onClick={handleCancelEdit}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors self-start bg-gray-500/20 text-gray-600 hover:bg-gray-500/30"
                  title="Cancel editing"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                  <span>Cancel</span>
                </button>
              )}

              {showDeleteButton && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors self-start bg-red-500/20 text-red-600 hover:bg-red-500/30"
                  title="Delete comic"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                  <span>Delete</span>
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

        {/* Edit Mode - Voice Settings & Actions */}
        {isEditMode && (
          <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-400 rounded-lg">
            <h3 className="text-lg font-semibold text-orange-800 dark:text-orange-300 mb-4">
              Edit Mode - Voice & Panel Settings
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Voice Selection */}
              <div>
                <label htmlFor="voice-select-modal" className="block text-sm font-medium text-orange-700 dark:text-orange-300 mb-2">
                  Select Voice
                </label>
                <select
                  id="voice-select-modal"
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="w-full px-3 py-2 border border-orange-300 dark:border-orange-600 rounded-lg bg-white dark:bg-orange-900/50 text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="L1aJrPa7pLJEyYlh3Ilq">Oliver (default)</option>
                  <option value="NNl6r8mD7vthiJatiJt1">Bradford</option>
                  <option value="goT3UYdM9bhm0n2lmKQx">Edward</option>
                  <option value="O4fnkotIypvedJqBp4yb">Alexis</option>
                </select>
              </div>

              {/* Speed Slider */}
              <div>
                <label htmlFor="speed-slider-modal" className="block text-sm font-medium text-orange-700 dark:text-orange-300 mb-2">
                  Voice Speed: {voiceSpeed.toFixed(2)}x
                </label>
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-orange-600 dark:text-orange-400">0.7x</span>
                  <input
                    id="speed-slider-modal"
                    type="range"
                    min="0.7"
                    max="1.2"
                    step="0.05"
                    value={voiceSpeed}
                    onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
                    className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #f97316 0%, #f97316 ${((voiceSpeed - 0.7) / (1.2 - 0.7)) * 100}%, #d1d5db ${((voiceSpeed - 0.7) / (1.2 - 0.7)) * 100}%, #d1d5db 100%)`
                    }}
                  />
                  <span className="text-xs text-orange-600 dark:text-orange-400">1.2x</span>
                </div>
                <style jsx>{`
                  input[type="range"]::-webkit-slider-thumb {
                    appearance: none;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: #f97316;
                    cursor: pointer;
                    border: 2px solid white;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                  }
                  input[type="range"]::-moz-range-thumb {
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: #f97316;
                    cursor: pointer;
                    border: 2px solid white;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                  }
                  input[type="range"]:focus {
                    outline: none;
                  }
                  input[type="range"]:focus::-webkit-slider-thumb {
                    box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.3);
                  }
                  input[type="range"]:focus::-moz-range-thumb {
                    box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.3);
                  }
                `}</style>
              </div>
            </div>

            {/* Regenerate All Audio Button */}
            <button
              onClick={handleRegenerateAllAudio}
              disabled={regeneratingAllAudio}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
            >
              {regeneratingAllAudio ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Regenerating All Audio...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                  <span>Regenerate All Audio</span>
                </>
              )}
            </button>
            
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-3">
              Click any panel below to edit its narration. Use "Regenerate All Audio" button above to generate voices with your chosen settings.
            </p>
          </div>
        )}


        {/* Single column view (mobile) - Normal order 1,2,3,4,5,6 */}
        <div className="sm:hidden flex flex-col gap-6">
          {(() => {
            const sortedPanels = comic.panels
              .filter(panel => panel.panel_number > 0)
              .sort((a, b) => a.panel_number - b.panel_number);
            
            return sortedPanels.map((panel) => {
              const isCurrentlyPlaying = currentPlayingPanel === panel.panel_number;
              const isEditing = editingPanel?.id === panel.id;
              const isEditable = isEditMode;
              return (
              <div
                key={panel.id}
                className={`bg-background-tertiary overflow-hidden transition-all duration-300 border-4 break-inside-avoid ${
                  isEditable
                    ? 'border-orange-400 cursor-pointer hover:border-orange-500' 
                    : isCurrentlyPlaying
                      ? 'border-orange-500'
                      : 'border-black'
                } ${isEditing ? 'ring-2 ring-orange-500' : ''}`}
                onClick={isEditable ? () => handleEditPanel(panel) : undefined}
              >
                {imageErrors[`${comic.id}-${panel.id}`] ? (
                  <div className="w-full h-48 bg-background-secondary flex items-center justify-center">
                    <div className="text-foreground-muted text-center">
                      <div className="text-2xl mb-2">🖼️</div>
                      <div className="text-sm">Image not available</div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Image Container */}
                    <div className="relative w-full aspect-[4/3]">
                      <Image
                        src={panel.public_url}
                        alt={`Panel ${panel.panel_number}`}
                        width={400}
                        height={192}
                        className="w-full h-full object-cover bg-white"
                        onError={() => handleImageError(`${comic.id}-${panel.id}`)}
                      />
                      
                      {/* Edit Status Badges */}
                      {isEditable && !isEditing && (
                        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                          <div className="bg-orange-500 text-white px-2 py-1 rounded text-xs font-medium shadow-lg">
                            Click to Edit
                          </div>
                          {!panel.narration && (
                            <div className="bg-red-500 text-white px-2 py-1 rounded text-xs font-medium shadow-lg">
                              No Narration
                            </div>
                          )}
                          {!panel.audio_url && panel.narration && (
                            <div className="bg-yellow-500 text-white px-2 py-1 rounded text-xs font-medium shadow-lg">
                              No Audio
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Narration Below - All screen sizes */}
                    {((panel.narration && showNarration) || isEditing) && (
                      <div 
                        className={`px-3 py-2 border-t-4 border-black transition-all duration-300 ${
                          isCurrentlyPlaying ? 'bg-accent' : 'bg-gray-50 dark:bg-black'
                        }`}
                      >
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingNarration}
                              onChange={(e) => setEditingNarration(e.target.value)}
                              className="w-full p-2 text-sm bg-white text-black rounded border-0 focus:ring-2 focus:ring-orange-500 resize-none"
                              rows={2}
                              placeholder="Enter narration..."
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex gap-1 flex-wrap">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveNarration();
                                }}
                                disabled={isUpdatingNarration || !editingNarration.trim()}
                                className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
                              >
                                {isUpdatingNarration ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingPanel(null);
                                  setEditingNarration('');
                                  setEditingPrompt('');
                                }}
                                className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className={`text-sm italic leading-tight ${
                            isCurrentlyPlaying ? 'text-white' : 'text-gray-800 dark:text-gray-100'
                          }`}>{panel.narration}</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              );
            });
          })()}
        </div>

        {/* Two column view (tablet and up) - Reordered for proper reading */}
        <div className="hidden sm:block columns-2 gap-6">
          {(() => {
            const sortedPanels = comic.panels
              .filter(panel => panel.panel_number > 0)
              .sort((a, b) => a.panel_number - b.panel_number);
            
            // Reorder for 2-column layout: [1,3,5...] then [2,4,6...]
            // This makes columns display as: 1,2 | 3,4 | 5,6
            const leftColumn = sortedPanels.filter((_, i) => i % 2 === 0);
            const rightColumn = sortedPanels.filter((_, i) => i % 2 === 1);
            const reordered = [...leftColumn, ...rightColumn];
            
            return reordered.map((panel) => {
              const isCurrentlyPlaying = currentPlayingPanel === panel.panel_number;
              const isEditing = editingPanel?.id === panel.id;
              const isEditable = isEditMode;
              return (
              <div
                key={panel.id}
                className={`bg-background-tertiary overflow-hidden transition-all duration-300 border-4 mb-6 break-inside-avoid ${
                  isEditable
                    ? 'border-orange-400 cursor-pointer hover:border-orange-500' 
                    : isCurrentlyPlaying
                      ? 'border-orange-500'
                      : 'border-black'
                } ${isEditing ? 'ring-2 ring-orange-500' : ''}`}
                onClick={isEditable ? () => handleEditPanel(panel) : undefined}
              >
                {imageErrors[`${comic.id}-${panel.id}`] ? (
                  <div className="w-full h-48 bg-background-secondary flex items-center justify-center">
                    <div className="text-foreground-muted text-center">
                      <div className="text-2xl mb-2">🖼️</div>
                      <div className="text-sm">Image not available</div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Image Container */}
                    <div className="relative w-full aspect-[4/3]">
                      <Image
                        src={panel.public_url}
                        alt={`Panel ${panel.panel_number}`}
                        width={400}
                        height={192}
                        className="w-full h-full object-cover bg-white"
                        onError={() => handleImageError(`${comic.id}-${panel.id}`)}
                      />
                      
                      {/* Edit Status Badges */}
                      {isEditable && !isEditing && (
                        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                          <div className="bg-orange-500 text-white px-2 py-1 rounded text-xs font-medium shadow-lg">
                            Click to Edit
                          </div>
                          {!panel.narration && (
                            <div className="bg-red-500 text-white px-2 py-1 rounded text-xs font-medium shadow-lg">
                              No Narration
                            </div>
                          )}
                          {!panel.audio_url && panel.narration && (
                            <div className="bg-yellow-500 text-white px-2 py-1 rounded text-xs font-medium shadow-lg">
                              No Audio
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Narration Below - All screen sizes */}
                    {((panel.narration && showNarration) || isEditing) && (
                      <div 
                        className={`px-3 py-2 border-t-4 border-black transition-all duration-300 ${
                          isCurrentlyPlaying ? 'bg-accent' : 'bg-gray-50 dark:bg-black'
                        }`}
                      >
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingNarration}
                              onChange={(e) => setEditingNarration(e.target.value)}
                              className="w-full p-2 text-sm bg-white text-black rounded border-0 focus:ring-2 focus:ring-orange-500 resize-none"
                              rows={2}
                              placeholder="Enter narration..."
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex gap-1 flex-wrap">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveNarration();
                                }}
                                disabled={isUpdatingNarration || !editingNarration.trim()}
                                className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
                              >
                                {isUpdatingNarration ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingPanel(null);
                                  setEditingNarration('');
                                  setEditingPrompt('');
                                }}
                                className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className={`text-sm italic leading-tight ${
                            isCurrentlyPlaying ? 'text-white' : 'text-gray-800 dark:text-gray-100'
                          }`}>{panel.narration}</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        title="Delete Comic"
        message={
          <div>
            Are you sure you want to delete &ldquo;{comic.title}&rdquo;? 
            <br />
            <span className="text-red-500 font-medium">This action cannot be undone.</span>
          </div>
        }
        confirmText={isDeleting ? 'Deleting...' : 'Delete'}
        cancelText="Cancel"
        isOpen={showDeleteConfirm}
        onConfirm={handleDeleteComic}
        onCancel={() => setShowDeleteConfirm(false)}
        isConfirming={isDeleting}
        confirmButtonStyle="danger"
      />
    </Modal>
  )
}
