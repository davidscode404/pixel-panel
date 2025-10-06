'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';

interface KanVibeModalProps {
  isOpen: boolean;
  onClose: () => void;
  autoPlay?: boolean;
}

const SCENES = [1, 2, 3, 4, 5, 6];

export default function KanVibeModal({ isOpen, onClose, autoPlay = false }: KanVibeModalProps) {
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [currentPlayingScene, setCurrentPlayingScene] = useState<number | null>(null);
  const videoRefs = useRef<{[key: number]: HTMLVideoElement | null}>({});

  const stopAudio = () => {
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      audioElement.onended = null;
      audioElement.onerror = null;
      setAudioElement(null);
    }
    setPlayingAudio(null);
    setCurrentPlayingScene(null);
  };

  const playKanVibeSequentially = useCallback(() => {
    // Stop any currently playing audio
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      audioElement.onended = null;
      audioElement.onerror = null;
    }

    // If already playing, stop it
    if (playingAudio === 'kan-vibe') {
      setPlayingAudio(null);
      setAudioElement(null);
      setCurrentPlayingScene(null);
      return;
    }

    let currentIndex = 0;

    const playNextScene = () => {
      if (currentIndex >= SCENES.length) {
        // All scenes played
        setPlayingAudio(null);
        setAudioElement(null);
        setCurrentPlayingScene(null);
        return;
      }

      const sceneNumber = SCENES[currentIndex];
      setCurrentPlayingScene(sceneNumber);

      // Play the video for this scene
      const video = videoRefs.current[sceneNumber];
      if (video) {
        video.currentTime = 0;
        video.play().catch(console.error);
      }

      // Play the audio for this scene
      const audio = new Audio(`/saved-comics/kan_vibe/scene${sceneNumber}.mp3`);
      
      // Set up event handlers before setting state
      audio.onended = () => {
        currentIndex++;
        playNextScene();
      };

      audio.onerror = () => {
        console.error('Audio playback error for scene:', sceneNumber);
        currentIndex++;
        playNextScene();
      };

      // Set state after setting up handlers
      setAudioElement(audio);
      setPlayingAudio('kan-vibe');

      // Play the audio
      audio.play().catch((error) => {
        console.error('Failed to play audio:', error);
        currentIndex++;
        playNextScene();
      });
    };

    playNextScene();
  }, [audioElement, playingAudio]);

  const handleClose = () => {
    stopAudio();
    // Stop all videos
    Object.values(videoRefs.current).forEach(video => {
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
    });
    onClose();
  };

  const handleSceneClick = () => {
    // Stop current audio if playing
    if (playingAudio) {
      stopAudio();
    }
  };

  // Auto-play when modal opens with autoPlay enabled
  useEffect(() => {
    if (isOpen && autoPlay) {
      // Small delay to ensure modal is fully rendered
      const timer = setTimeout(() => {
        playKanVibeSequentially();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoPlay, playKanVibeSequentially]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
    };
  }, [audioElement]);

  if (!isOpen) return null;

  return (
    <Modal onClose={handleClose}>
      <div className="max-w-4xl max-h-[90vh] overflow-y-auto p-6 scrollbar-hide">
        <div className="flex justify-between items-start mb-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={playKanVibeSequentially}
                className="bg-accent hover:bg-accent-hover text-white rounded-full p-2 transition-all duration-200 hover:scale-110"
                aria-label={playingAudio === 'kan-vibe' ? "Stop playback" : "Play KAN_VIBE"}
              >
                {playingAudio === 'kan-vibe' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <h2 className="text-2xl font-bold text-foreground">Kan Vibe</h2>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="text-foreground-muted hover:text-foreground text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Scene Grid */}
        <div className="grid grid-cols-2 gap-4">
          {SCENES.map((sceneNumber) => {
            const isCurrentlyPlaying = currentPlayingScene === sceneNumber;
            return (
              <div
                key={sceneNumber}
                className={`bg-background-tertiary overflow-hidden transition-all duration-300 relative border-4 ${
                  isCurrentlyPlaying ? 'border-accent ring-2 ring-accent' : 'border-black'
                } cursor-pointer hover:border-accent`}
                onClick={handleSceneClick}
              >
                <div className="relative w-full aspect-[4/3]">
                  <video
                    ref={(el) => { videoRefs.current[sceneNumber] = el; }}
                    className="w-full h-full object-cover"
                    preload="metadata"
                    src={`/saved-comics/kan_vibe/scene${sceneNumber}.mp4#t=0.1`}
                    muted
                    loop
                  />
                  {isCurrentlyPlaying && (
                    <div className="absolute bottom-0 left-0 right-0 bg-accent px-3 py-2">
                      <p className="text-white text-sm font-medium">Now Playing</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
