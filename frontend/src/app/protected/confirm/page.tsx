'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { buildApiUrl, API_CONFIG } from '@/config/api';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';

const supabase = createSupabaseClient();

interface PanelData {
  id: number;
  prompt: string;
  image_data: string;
  is_zoomed: boolean;
  narration?: string;
}

export default function ConfirmComicPage() {
  const router = useRouter();
  const { } = useAuth();
  
  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [tags, setTags] = useState('');
  
  // Comic data
  const [panelsData, setPanelsData] = useState<PanelData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Narration states
  const [generatingNarrations, setGeneratingNarrations] = useState(false);
  const [narrationsGenerated, setNarrationsGenerated] = useState(false);

  // Thumbnail states
  const [thumbnailData, setThumbnailData] = useState<string | null>(null);
  const [generatingThumbnail, setGeneratingThumbnail] = useState(false);

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
      console.error('Error loading comic data:', error);
      setError('Failed to load comic data. Please try again.');
    }
  }, []);

  // Auto-generate narrations when panels are loaded
  useEffect(() => {
    if (panelsData.length > 0 && !narrationsGenerated && !generatingNarrations) {
      console.log('Auto-generating narrations for panels...');
      generateNarrations();
    }
  }, [panelsData]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const updatedPanels = await Promise.all(
        panelsData.map(async (panel) => {
          try {
            const response = await fetch(buildApiUrl('/api/voice-over/generate-story'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ story: panel.prompt }),
            });
            
            if (!response.ok) {
              throw new Error(`Failed to generate narration for panel ${panel.id}`);
            }
            
            const narrationData = await response.json();
            const narration = narrationData.narration || narrationData.story || `Narration for: ${panel.prompt}`;
            
            return {
              ...panel,
              narration: narration
            };
          } catch (error) {
            console.error(`Error generating narration for panel ${panel.id}:`, error);
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
      console.error('Error generating narrations:', error);
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

      console.log('🎨 Generating thumbnail with prompts:', prompts);

      const response = await fetch(buildApiUrl('/api/comics/generate-thumbnail'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
        console.log('✅ Thumbnail generated successfully');
      } else {
        throw new Error('Invalid response from thumbnail generation');
      }
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      setError('Failed to generate thumbnail. Please try again.');
    } finally {
      setGeneratingThumbnail(false);
    }
  };

  const generateAudioForPanels = async () => {
    console.log('🎵 Generating audio for all panels...');
    console.log('🔍 Panels to process:', panelsData.map(p => ({ id: p.id, hasNarration: !!p.narration })));

    const updatedPanels = await Promise.all(
      panelsData.map(async (panel) => {
        // Skip if no narration
        if (!panel.narration) {
          console.log(`⚠️ Panel ${panel.id} has no narration, skipping audio generation`);
          return panel;
        }

        try {
          console.log(`🎤 Generating audio for panel ${panel.id} with narration: "${panel.narration.substring(0, 50)}..."`);

          const url = new URL(buildApiUrl('/api/voice-over/generate-voiceover'));
          url.searchParams.append('narration', panel.narration);

          const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            console.warn(`❌ Failed to generate audio for panel ${panel.id}: ${response.status} ${response.statusText}`);
            return panel;
          }

          const audioData = await response.json();
          console.log(`✅ Audio generated for panel ${panel.id}, size: ${audioData.audio?.length || 0} bytes`);

          return {
            ...panel,
            audio_data: audioData.audio
          };
        } catch (error) {
          console.error(`❌ Error generating audio for panel ${panel.id}:`, error);
          return panel;
        }
      })
    );

    console.log('🔍 Updated panels with audio:', updatedPanels.map(p => ({ id: p.id, hasAudio: !!p.audio_data, audioSize: p.audio_data?.length })));
    return updatedPanels;
  };

  const handleSaveComic = async () => {
    if (!title.trim()) {
      alert('Please enter a title for your comic.');
      return;
    }

    if (panelsData.length === 0) {
      alert('No comic panels found. Please go back to create panels.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      
      // Generate audio for all panels with narrations
      console.log('🎵 Generating audio for panels...');
      const panelsWithAudio = await generateAudioForPanels();
      
      const payload = {
        title: title.trim(),
        description: description.trim(),
        is_public: isPublic,
        tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
        panels: panelsWithAudio,
        thumbnail_data: thumbnailData  // Include thumbnail if generated
      };

      console.log('🔍 DEBUG: Saving comic with payload (audio included)');

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
      console.log('✅ Comic saved successfully:', result);

      // Clear sessionStorage
      sessionStorage.removeItem('comicPanelsData');

      // Redirect to success page or comics list
      router.push('/protected/comics');

    } catch (error) {
      console.error('❌ Error saving comic:', error);
      setError(error instanceof Error ? error.message : 'Failed to save comic');
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  if (error && panelsData.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-error text-xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-foreground mb-4">No Comic Data Found</h2>
          <p className="text-foreground-secondary mb-6">{error}</p>
          <Link
            href="/protected/create"
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
            <Link href="/protected/create" className="hover:text-foreground transition-colors">Create</Link>
            <span>›</span>
            <span className="text-foreground">Publish Comic</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Publish Your Comic</h1>
          <p className="text-foreground-secondary">Configure your comic details and publish it to the world.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Side - Comic Preview */}
          <div className="space-y-6">
            <div className="bg-background-card rounded-xl p-6 border border-border">
              <h2 className="text-xl font-bold text-foreground mb-4">Comic Preview</h2>
              
              {/* Comic Title Display */}
              <div className="bg-background-tertiary rounded-lg p-4 mb-6 border-2 border-black">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Untitled Comic"
                  className="w-full text-2xl font-bold text-foreground text-center bg-transparent focus:outline-none focus:ring-2 focus:ring-accent rounded px-2 py-1"
                  maxLength={100}
                />
              </div>

              {/* Panels Preview */}
              <div className="space-y-4">
                {panelsData.map((panel) => (
                  <div 
                    key={panel.id}
                    className="bg-background-tertiary rounded-lg border-2 border-black overflow-hidden"
                  >
                    {/* Panel Image */}
                    <div className="aspect-[4/3] bg-background-tertiary overflow-hidden">
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
                    </div>
                    
                    {/* Panel Narration */}
                    <div className="p-4 border-t border-border">
                      <div className="text-sm font-medium text-foreground-secondary mb-2">
                        Panel {panel.id} Narration:
                      </div>
                      {panel.narration ? (
                        <textarea
                          value={panel.narration}
                          onChange={(e) => {
                            const updatedPanels = panelsData.map(p =>
                              p.id === panel.id ? { ...p, narration: e.target.value } : p
                            );
                            setPanelsData(updatedPanels);
                          }}
                          className="w-full text-sm text-foreground bg-background-secondary rounded p-3 border border-border focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none"
                          rows={3}
                        />
                      ) : (
                        <div className="text-sm text-foreground-muted italic">
                          No narration generated yet
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Auto-generation status */}
              {generatingNarrations && (
                <div className="mt-4 p-4 bg-accent/10 border border-accent/20 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent"></div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Generating narrations...</p>
                    </div>
                  </div>
                </div>
              )}


              {/* Regenerate Narrations Button (only shown after generation) */}
              {narrationsGenerated && (
                <div className="mt-4">
                  <button
                    onClick={generateNarrations}
                    disabled={generatingNarrations}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-background-secondary hover:bg-background-tertiary disabled:opacity-50 text-foreground rounded-lg transition-colors font-medium border border-border"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Regenerate Narrations</span>
                  </button>
                </div>
              )}

              {/* Generate Thumbnail Button */}
              <div className="mt-4">
                <button
                  onClick={generateThumbnail}
                  disabled={generatingThumbnail || panelsData.length === 0}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-foreground-inverse rounded-lg transition-colors font-medium"
                >
                  {generatingThumbnail ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-foreground-inverse"></div>
                      <span>Generating Thumbnail...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{thumbnailData ? 'Regenerate Thumbnail' : 'Generate Thumbnail'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Thumbnail Preview */}
              {thumbnailData && (
                <div className="mt-4 p-4 bg-background-tertiary rounded-lg border-2 border-border">
                  <p className="text-sm font-medium text-foreground-secondary mb-2">Generated Thumbnail:</p>
                  <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden border-2 border-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbnailData}
                      alt="Comic Thumbnail"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-xs text-foreground-muted mt-2">This thumbnail will be used for displaying your comic</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Comic Configuration Form */}
          <div className="space-y-6">
            {/* Comic Details Form */}
            <div className="bg-background-card rounded-xl p-6 border border-border">
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

            {/* Actions */}
            <div className="bg-background-card rounded-xl p-6 border border-border">
              <h2 className="text-xl font-bold text-foreground mb-4">Publish Comic</h2>
              
              {error && (
                <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg">
                  <p className="text-error text-sm">{error}</p>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={handleSaveComic}
                  disabled={loading || !title.trim()}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-accent hover:bg-accent-hover disabled:bg-background-muted disabled:cursor-not-allowed text-foreground-inverse rounded-lg transition-colors font-medium"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-foreground-inverse"></div>
                      <span>Publishing (generating audio)...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Publish Comic</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleGoBack}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-background-secondary hover:bg-background-tertiary disabled:opacity-50 text-foreground rounded-lg transition-colors font-medium border border-border"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span>Back to Edit</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}