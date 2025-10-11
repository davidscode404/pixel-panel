'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { buildApiUrl, API_CONFIG } from '@/config/api';
import AlertBanner from '@/components/ui/AlertBanner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import type { PanelData } from '@/types';

const supabase = createSupabaseClient();

export default function ConfirmComicPage() {
  const router = useRouter();
  
  // Form states
  const [title, setTitle] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  
  // Comic data
  const [panelsData, setPanelsData] = useState<PanelData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  
  // Narration states
  const [generatingNarrations, setGeneratingNarrations] = useState(false);
  const [narrationsGenerated, setNarrationsGenerated] = useState(false);

  // Thumbnail states
  const [thumbnailData, setThumbnailData] = useState<string | null>(null);
  const [generatingThumbnail, setGeneratingThumbnail] = useState(false);

  // Voice generation states
  const [generatingVoices, setGeneratingVoices] = useState(false);
  const [voicesGenerated, setVoicesGenerated] = useState(false);
  const [audioData, setAudioData] = useState<{ [key: number]: string }>({});
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [playingPanelId, setPlayingPanelId] = useState<number | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>('L1aJrPa7pLJEyYlh3Ilq'); // Oliver (default)
  const [voiceSpeed, setVoiceSpeed] = useState<number>(1.0); // Default normal speed

  // Load comic data from sessionStorage
  useEffect(() => {
    try {
      const storedPanelsData = sessionStorage.getItem('comicPanelsData');

      if (storedPanelsData) {
        const panels = JSON.parse(storedPanelsData);
        setPanelsData(panels);
      } else {
        setError('No comic data found. Please go back to create a comic.');
        return;
      }
    } catch (error) {
      setError('Failed to load comic data. Please try again.');
    }
  }, []);

  const getAccessToken = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      throw new Error('Authentication required');
    }
    return session.access_token;
  };

  const generateNarrations = async () => {
    if (panelsData.length === 0) return;
    
    setGeneratingNarrations(true);
    setError(null);
    
    try {
      // Get access token for authentication
      const accessToken = await getAccessToken();
      
      const updatedPanels = await Promise.all(
        panelsData.map(async (panel) => {
          try {
            const response = await fetch(buildApiUrl('/api/voice-over/generate-story'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
              },
              body: JSON.stringify({ story: panel.prompt }),
            });
            
            if (!response.ok) {
              throw new Error(`Failed to generate narration for panel ${panel.id}`);
            }
            
            const narrationData = await response.json();
            let narration = narrationData.story || narrationData.narration || `Narration for: ${panel.prompt}`;
            
            // Ensure narration is a string, not an object
            if (typeof narration !== 'string') {
              narration = `Narration for: ${panel.prompt}`;
            }
            
            return {
              ...panel,
              narration: narration
            };
          } catch (error) {
            return {
              ...panel,
              narration: `Narration for: ${panel.prompt}`
            };
          }
        })
      );
      
      setPanelsData(updatedPanels);
      setNarrationsGenerated(true);
    } catch (error) {
      setError('Failed to generate narrations. Please try again.');
    } finally {
      setGeneratingNarrations(false);
    }
  };

  const generateThumbnail = async () => {
    if (panelsData.length === 0) return;

    setGeneratingThumbnail(true);
    setError(null);

    try {
      // Collect prompts from all panels
      const prompts = panelsData.map(panel => panel.prompt);
      
      // Get access token for authentication
      const accessToken = await getAccessToken();

      const response = await fetch(buildApiUrl('/api/comics/generate-thumbnail'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ prompts }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate thumbnail: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.thumbnail_data) {
        // Store thumbnail data with data URL prefix for display
        const thumbnailDataUrl = `data:image/png;base64,${result.thumbnail_data}`;
        setThumbnailData(thumbnailDataUrl);
      } else {
        throw new Error('Invalid response from thumbnail generation');
      }
    } catch (error) {
      setError('Failed to generate thumbnail. Please try again.');
    } finally {
      setGeneratingThumbnail(false);
    }
  };

  const generateVoices = async () => {
    if (panelsData.length === 0 || !narrationsGenerated) return;
    
    setGeneratingVoices(true);
    setError(null);
    
    try {
      const accessToken = await getAccessToken();
      const audioResults: { [key: number]: string } = {};
      const errors: string[] = [];
      
      // Generate voice for each panel with narration
      for (const panel of panelsData) {
        if (panel.narration) {
          try {
            const response = await fetch(buildApiUrl('/api/voice-over/generate-voiceover'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
              },
              body: JSON.stringify({ 
                narration: panel.narration,
                voice_id: selectedVoice,
                speed: voiceSpeed
              }),
            });
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              const errorMsg = errorData.detail || `HTTP ${response.status}`;
              errors.push(`Panel ${panel.id}: ${errorMsg}`);
              console.error(`Failed to generate voice for panel ${panel.id}:`, errorMsg);
              continue;
            }
            
            const result = await response.json();
            
            if (result.audio) {
              audioResults[Number(panel.id)] = result.audio;
            } else {
              errors.push(`Panel ${panel.id}: No audio data received`);
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Panel ${panel.id}: ${errorMsg}`);
            console.error(`Failed to generate voice for panel ${panel.id}:`, error);
          }
        }
      }
      
      setAudioData(audioResults);
      
      // Set voices as generated if at least one succeeded
      if (Object.keys(audioResults).length > 0) {
        setVoicesGenerated(true);
      }
      
      // Show errors if any occurred
      if (errors.length > 0) {
        if (Object.keys(audioResults).length === 0) {
          setError(`All voices failed to generate:\n${errors.join('\n')}`);
        } else {
          setError(`Some voices failed:\n${errors.join('\n')}`);
        }
      } else if (Object.keys(audioResults).length === 0) {
        setError('No voices were generated. Please check your narrations.');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setError(`Failed to generate voices: ${errorMsg}`);
      console.error('Error in generateVoices:', error);
    } finally {
      setGeneratingVoices(false);
    }
  };

  // Helper function to update panel narration
  const updatePanelNarration = (panelId: number, narration: string) => {
    const updatedPanels = panelsData.map(p =>
      p.id === panelId ? { ...p, narration } : p
    );
    setPanelsData(updatedPanels);
  };

  // Toggle play/pause audio for a specific panel
  const toggleAudio = (panelId: number) => {
    // If this panel is currently playing, pause it
    if (playingPanelId === panelId && currentAudio) {
      currentAudio.pause();
      setPlayingPanelId(null);
      return;
    }
    
    // If another audio is playing, stop it
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    
    // Play the new audio
    const audio = audioData[panelId];
    if (audio) {
      const audioElement = new Audio(`data:audio/mp3;base64,${audio}`);
      
      // Set up event listeners
      audioElement.addEventListener('ended', () => {
        setPlayingPanelId(null);
        setCurrentAudio(null);
      });
      
      audioElement.addEventListener('error', () => {
        setPlayingPanelId(null);
        setCurrentAudio(null);
        setError(`Failed to play audio for panel ${panelId}`);
      });
      
      audioElement.play();
      setCurrentAudio(audioElement);
      setPlayingPanelId(panelId);
    }
  };
  
  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
    };
  }, [currentAudio]);

  // Retry voice generation for a specific panel
  const retryVoiceGeneration = async (panelId: number) => {
    const panel = panelsData.find(p => p.id === panelId);
    if (!panel || !panel.narration) return;
    
    // Stop currently playing audio if it's this panel
    if (playingPanelId === panelId && currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setPlayingPanelId(null);
      setCurrentAudio(null);
    }
    
    setError(null);
    
    try {
      const accessToken = await getAccessToken();
      const response = await fetch(buildApiUrl('/api/voice-over/generate-voiceover'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ 
          narration: panel.narration,
          voice_id: selectedVoice,
          speed: voiceSpeed
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to regenerate voice for panel ${panelId}`);
      }
      
      const result = await response.json();
      
      if (result.audio) {
        setAudioData(prev => ({ ...prev, [panelId]: result.audio }));
      }
    } catch (error) {
      setError(`Failed to regenerate voice for panel ${panelId}. Please try again.`);
    }
  };

  // Helper function to render loading spinner
  const renderLoadingSpinner = (text: string) => (
    <>
      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-foreground-inverse"></div>
      <span>{text}</span>
    </>
  );

  // Helper function to render checklist icon
  const renderChecklistIcon = (isComplete: boolean) => (
    isComplete ? (
      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ) : (
      <svg className="w-5 h-5 text-foreground-muted flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    )
  );

  const handleSaveComic = async () => {
    if (!title.trim()) {
      setError('Please enter a title for your comic.');
      return;
    }

    if (panelsData.length === 0) {
      setError('No comic panels found. Please go back to create panels.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      
      // Merge audio data into panels before saving
      const panelsWithAudio = panelsData.map(panel => ({
        ...panel,
        audio_data: audioData[Number(panel.id)] || panel.audio_data || null
      }));
      
      const payload = {
        title: title.trim(),
        is_public: isPublic,
        panels: panelsWithAudio,
        thumbnail_data: thumbnailData  // Include thumbnail if generated
      };

      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.SAVE_COMIC), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.detail || err?.error || `Save failed with status ${response.status}`);
      }

      const result = await response.json();

      // Clear sessionStorage
      sessionStorage.removeItem('comicPanelsData');

      // Redirect to success page or comics list
      router.push('/app/comics');

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save comic');
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    setShowConfirmClear(true);
  };

  const confirmClearAndBack = () => {
    try {
      sessionStorage.removeItem('comicPanelsData');
    } catch {}
    setShowConfirmClear(false);
    router.push('/app/create');
  };

  if (error && panelsData.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-error text-xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-foreground mb-4">No Comic Data Found</h2>
          <p className="text-foreground-secondary mb-6">{error}</p>
          <Link
            href="/app/create"
            className="px-6 py-3 bg-accent hover:bg-accent-hover text-foreground-inverse rounded-lg transition-colors"
          >
            Back to Create
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 text-sm text-foreground-muted mb-4">
            <Link href="/app/create" className="hover:text-foreground transition-colors">Create</Link>
            <span>›</span>
            <span className="text-foreground">Publish Comic</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Publish Your Comic</h1>
              <p className="text-foreground-secondary">Configure your comic details and publish it to the world.</p>
            </div>
            <button
              onClick={handleGoBack}
              className="flex items-center space-x-2 px-4 py-2 bg-background-secondary hover:bg-background-tertiary text-foreground rounded-lg border border-border transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Edit</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[60%_40%] gap-8">
          {/* Left Side - Comic Preview */}
          <div className="space-y-6">
            <div className="bg-background-card p-6 border-4 border-black">
              <h2 className="text-xl font-bold text-foreground mb-4">Comic Preview</h2>
              
              {/* Panels Preview - 2x3 Grid */}
              <div className="grid grid-cols-2 gap-4">
                {panelsData.map((panel) => (
                  <div 
                    key={panel.id}
                    className="bg-background-tertiary border-2 border-black overflow-hidden"
                  >
                    {/* Panel Image */}
                    <div className="aspect-[4/3] bg-background-tertiary overflow-hidden relative">
                      {panel.image_data ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={panel.image_data}
                          alt={`Panel ${panel.id}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-foreground-muted">
                          <div className="text-center">
                            <div className="text-4xl mb-2">🖼️</div>
                            <div className="text-sm">Panel {panel.id}</div>
                          </div>
                        </div>
                      )}
                      {/* Panel Number Badge */}
                      <div className="absolute top-2 left-2 w-6 h-6 bg-accent backdrop-blur-sm flex items-center justify-center text-xs font-bold text-foreground-inverse border-2 border-black">
                        {panel.id}
                      </div>
                      
                      {/* Play/Pause and Retry Buttons - Show only after voice generation */}
                      {voicesGenerated && audioData[Number(panel.id)] && (
                        <div className="absolute top-2 right-2 flex space-x-1">
                          {/* Play/Pause Button */}
                          <button
                            onClick={() => toggleAudio(Number(panel.id))}
                            className={`w-7 h-7 ${
                              playingPanelId === Number(panel.id) 
                                ? 'bg-orange-500 hover:bg-orange-600' 
                                : 'bg-green-500 hover:bg-green-600'
                            } flex items-center justify-center text-white rounded-full border-2 border-black transition-colors shadow-lg`}
                            title={playingPanelId === Number(panel.id) ? "Pause voice" : "Play voice"}
                          >
                            {playingPanelId === Number(panel.id) ? (
                              // Pause icon
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              // Play icon
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                              </svg>
                            )}
                          </button>
                          
                          {/* Retry Button */}
                          <button
                            onClick={() => retryVoiceGeneration(Number(panel.id))}
                            className="w-7 h-7 bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white rounded-full border-2 border-black transition-colors shadow-lg"
                            title="Regenerate voice"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Panel Narration - Editable */}
                    <div className="p-3 border-t-4 border-black">
                      <div className="text-xs font-medium text-foreground-secondary mb-1 flex items-center justify-between">
                        <span>Narration:</span>
                        <svg className="w-3 h-3 text-foreground-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                      {panel.narration ? (
                        <textarea
                          value={panel.narration}
                          onChange={(e) => updatePanelNarration(Number(panel.id), e.target.value)}
                          placeholder="Edit narration for this panel..."
                          className="w-full text-xs text-foreground bg-background-secondary rounded p-2 border border-border hover:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none transition-colors"
                          rows={2}
                        />
                      ) : (
                        <textarea
                          value=""
                          onChange={(e) => updatePanelNarration(Number(panel.id), e.target.value)}
                          placeholder="Click to add narration or generate using the button..."
                          className="w-full text-xs text-foreground-muted bg-background-secondary rounded p-2 border border-dashed border-border hover:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent focus:border-solid focus:border-accent resize-none transition-colors italic"
                          rows={2}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Side - Comic Configuration Form */}
          <div className="space-y-6">
            {/* Generation Actions - MOVED TO TOP */}
            <div className="bg-background-card p-6 border-4 border-black">
              <h2 className="text-xl font-bold text-foreground mb-4">Generation Actions</h2>
              <p className="text-sm text-foreground-secondary mb-4">
                Generate content for your comic before publishing.
              </p>
              
              <div className="space-y-3">
                {/* Generate Narrations Button */}
                <button
                  onClick={generateNarrations}
                  disabled={generatingNarrations || panelsData.length === 0}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-background-secondary hover:bg-background-tertiary disabled:opacity-50 text-foreground rounded-lg transition-colors font-medium border border-border"
                >
                  {generatingNarrations ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent"></div>
                      <span>Generating Narrations...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>{narrationsGenerated ? 'Regenerate Narrations' : 'Generate Narrations'}</span>
                    </>
                  )}
                </button>

                {/* Voice Selection Dropdown */}
                <div>
                  <label htmlFor="voice-select" className="block text-sm font-medium text-foreground-secondary mb-2">
                    Select Voice
                  </label>
                  <select
                    id="voice-select"
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                  >
                    <option value="L1aJrPa7pLJEyYlh3Ilq">Oliver (default)</option>
                    <option value="NNl6r8mD7vthiJatiJt1">Bradford</option>
                    <option value="goT3UYdM9bhm0n2lmKQx">Edward</option>
                    <option value="O4fnkotIypvedJqBp4yb">Alexis</option>
                  </select>
                </div>

                {/* Speed Slider */}
                <div>
                  <label htmlFor="speed-slider" className="block text-sm font-medium text-foreground-secondary mb-2">
                    Voice Speed: {voiceSpeed.toFixed(2)}x
                  </label>
                  <div className="flex items-center space-x-3">
                    <span className="text-xs text-foreground-muted">0.7x</span>
                    <input
                      id="speed-slider"
                      type="range"
                      min="0.7"
                      max="1.2"
                      step="0.05"
                      value={voiceSpeed}
                      onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
                      className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${((voiceSpeed - 0.7) / (1.2 - 0.7)) * 100}%, var(--border) ${((voiceSpeed - 0.7) / (1.2 - 0.7)) * 100}%, var(--border) 100%)`
                      }}
                    />
                    <span className="text-xs text-foreground-muted">1.2x</span>
                  </div>
                  <div className="flex justify-between text-xs text-foreground-muted mt-1">
                    <span>Slower</span>
                    <span>Normal</span>
                    <span>Faster</span>
                  </div>
                  <style jsx>{`
                    input[type="range"]::-webkit-slider-thumb {
                      appearance: none;
                      width: 16px;
                      height: 16px;
                      border-radius: 50%;
                      background: var(--accent);
                      cursor: pointer;
                      border: 2px solid var(--background-card);
                      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                    }
                    input[type="range"]::-moz-range-thumb {
                      width: 16px;
                      height: 16px;
                      border-radius: 50%;
                      background: var(--accent);
                      cursor: pointer;
                      border: 2px solid var(--background-card);
                      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
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

                {/* Generate Voice Button - NEW */}
                <button
                  onClick={generateVoices}
                  disabled={!narrationsGenerated || generatingVoices || panelsData.length === 0}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-background-secondary hover:bg-background-tertiary disabled:opacity-50 text-foreground rounded-lg transition-colors font-medium border border-border"
                >
                  {generatingVoices ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent"></div>
                      <span>Generating Voices...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                      <span>{voicesGenerated ? 'Regenerate Voices' : 'Generate Voice'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Generate Thumbnail Section */}
            <div className="bg-background-card p-6 border-4 border-black">
              <h2 className="text-xl font-bold text-foreground mb-4">Comic Thumbnail</h2>
              <p className="text-sm text-foreground-secondary mb-4">
                Generate a cover image for your comic that will be displayed in the comics gallery.
              </p>
              
              <button
                onClick={generateThumbnail}
                disabled={generatingThumbnail || panelsData.length === 0}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-foreground-inverse rounded-lg transition-colors font-medium"
              >
                {generatingThumbnail ? (
                  renderLoadingSpinner('Generating Thumbnail...')
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{thumbnailData ? 'Regenerate Thumbnail' : 'Generate Thumbnail'}</span>
                  </>
                )}
              </button>

              {/* Thumbnail Preview */}
              {thumbnailData && (
                <div className="mt-4 p-4 bg-background-tertiary border-4 border-black">
                  <p className="text-sm font-medium text-foreground-secondary mb-2">Generated Thumbnail:</p>
                  <div className="relative w-full aspect-[3/4] overflow-hidden border-2 border-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbnailData}
                      alt="Comic Thumbnail"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-xs text-foreground-muted mt-2">This thumbnail will be used as your comic cover</p>
                </div>
              )}
            </div>

            {/* Comic Details Form */}
            <div className="bg-background-card p-6 border-4 border-black">
              <h2 className="text-xl font-bold text-foreground mb-4">Comic Details</h2>
              
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-foreground-secondary mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background-secondary text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                    placeholder="Enter comic title..."
                    maxLength={100}
                  />
                </div>

                {/* Visibility */}
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary mb-2">
                    Visibility
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="visibility"
                        checked={isPublic}
                        onChange={() => setIsPublic(true)}
                        className="mr-2 text-accent focus:ring-accent"
                      />
                      <span className="text-foreground">Public - Anyone can view this comic</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="visibility"
                        checked={!isPublic}
                        onChange={() => setIsPublic(false)}
                        className="mr-2 text-accent focus:ring-accent"
                      />
                      <span className="text-foreground">Private - Only you can view this comic</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Publish Section */}
            <div className="bg-background-card p-6 border-4 border-black">
              <h2 className="text-xl font-bold text-foreground mb-4">Publish Comic</h2>
              
              {/* Publishing Checklist */}
                <div className="mb-4 p-4 bg-background-tertiary border-4 border-black">
                <p className="text-sm font-medium text-foreground mb-3">Before Publishing:</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2">
                    {renderChecklistIcon(Boolean(title.trim()))}
                    <span className={title.trim() ? 'text-foreground' : 'text-foreground-muted'}>
                      Add comic title
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {renderChecklistIcon(!!thumbnailData)}
                    <span className={thumbnailData ? 'text-foreground' : 'text-foreground-muted'}>
                      Generate thumbnail
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {renderChecklistIcon(panelsData.every(p => p.narration))}
                    <span className={panelsData.every(p => p.narration) ? 'text-foreground' : 'text-foreground-muted'}>
                      Generate narrations for all panels
                    </span>
                  </div>
                  
                  {/* DISABLED: Auto audio generation info */}
                  {/* <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span className="text-foreground">
                      Audio will be auto-generated during publishing
                    </span>
                  </div> */}
                </div>
                
                {(!title.trim() || !thumbnailData || !panelsData.every(p => p.narration)) && (
                  <p className="mt-3 text-xs text-foreground-muted italic">
                    Complete all items above to enable publishing
                  </p>
                )}
              </div>
              
              {error && (
                <AlertBanner type="error" message={error} />
              )}

              <div className="space-y-3">
                <button
                  onClick={handleSaveComic}
                  disabled={loading || !title.trim() || !thumbnailData || !panelsData.every(p => p.narration)}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-accent hover:bg-accent-hover disabled:bg-background-muted disabled:cursor-not-allowed text-foreground-inverse rounded-lg transition-colors font-medium"
                >
                  {loading ? (
                    renderLoadingSpinner('Publishing comic...')
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Publish Comic</span>
                    </>
                  )}
                </button>
                
                
              </div>
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={showConfirmClear}
        title="Leave Publish Flow?"
        message={
          <div>
            <p className="mb-2">Going back to edit will clear the current publish session.</p>
            <p className="text-sm text-foreground-muted">Your in-progress narrations and generated thumbnail on this page will be discarded.</p>
          </div>
        }
        confirmText="Yes, clear and go back"
        cancelText="Stay here"
        onConfirm={confirmClearAndBack}
        onCancel={() => setShowConfirmClear(false)}
      />
    </div>
  );
}