'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';

interface KanVibeModalProps {
  isOpen: boolean;
  onClose: () => void;
  autoPlay?: boolean;
}

const SCENES = [1, 2, 3, 4, 5, 6];

const SCENE_NARRATIONS: { [key: number]: string } = {
  1: "Louis sits at his desk, headphones on, staring at a glowing digital Kanban board on his laptop. On the corner of the screen, a tiny sticky note reads: \"Remember to vibe responsibly.\" Logging in... time to focus.",
  2: "Suddenly, Louis is transported inside a massive, glowing server room. Kanban boards float like holographic billboards between the servers. Task cards bounce to the beat of his music. A warning label stuck to a server rack reminds him: \"Remember to vibe responsibly.\" But the beat leaks into the system...",
  3: "The scene shifts to a futuristic cityscape at night. The Kanban board expands across skyscraper windows like digital graffiti. Louis skateboards down the street on a giant sticky note, as skyscrapers pulse with task columns. A digital billboard flashes: \"Remember to vibe responsibly.\" Now the whole city's in flow.",
  4: "Louis enters a neon-lit nightclub, where the Kanban board has become the dance floor grid. Task cards glow as dancers move to the rhythm. He DJs at the booth, spinning cards like vinyl records. On his wrist, a glowing band reads: \"Remember to vibe responsibly.\" The backlog drops the bass.",
  5: "Out in outer space, the Kanban board floats like a cosmic circuit board. A giant corrupted task card, labeled \"Blocked,\" mutates into a fearsome boss monster. Louis wields soundwaves, battling it mid-air among orbiting task cards. A passing asteroid etches the words: \"Remember to vibe responsibly.\" Every vibe faces resistance.",
  6: "Finally, Louis arrives in a serene, surreal world glowing like digital heaven. The \"Done\" column stretches infinitely, a golden road ahead. Half-human, half-digital Kanban god, he walks peacefully forward. Sticky notes rain down like cherry blossoms. And in the distance, the tiny card floats slowly, shining as eternal wisdom: \"Remember to vibe responsibly.\" All tasks complete. All vibes eternal."
};

export default function KanVibeModal({ isOpen, onClose, autoPlay = false }: KanVibeModalProps) {
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [currentPlayingScene, setCurrentPlayingScene] = useState<number | null>(null);
  const [showNarration, setShowNarration] = useState(true);
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

      // Play the audio for this scene with cache-busting
      const audioUrl = `/saved-comics/kan_vibe/scene${sceneNumber}.mp3?_cb=${Date.now()}`;
      const audio = new Audio(audioUrl);
      
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
        <div className="columns-1 sm:columns-2 gap-4">
          {SCENES.map((sceneNumber) => {
            const isCurrentlyPlaying = currentPlayingScene === sceneNumber;
            return (
              <div
                key={sceneNumber}
                className={`bg-background-tertiary overflow-hidden transition-all duration-300 border-4 mb-4 break-inside-avoid ${
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
                </div>
                {/* Narration Below - All screen sizes */}
                {showNarration && SCENE_NARRATIONS[sceneNumber] && (
                  <div className={`px-3 py-2 border-t-4 border-black transition-all duration-300 ${
                    isCurrentlyPlaying ? 'bg-accent' : 'bg-white dark:bg-black'
                  }`}>
                    <p className={`text-sm italic leading-tight ${
                      isCurrentlyPlaying ? 'text-white' : 'text-black dark:text-white'
                    }`}>{SCENE_NARRATIONS[sceneNumber]}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
