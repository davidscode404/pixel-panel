'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { buildApiUrl, API_CONFIG } from '@/config/api';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import type { PanelData } from '@/types';

const supabase = createSupabaseClient();

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
      } else {
        throw new Error('Invalid response from thumbnail generation');
      }
    } catch (error) {
      setError('Failed to generate thumbnail. Please try again.');
    } finally {
      setGeneratingThumbnail(false);
    }
  };

  const generateAudioForPanels = async () => {
    const updatedPanels = await Promise.all(
      panelsData.map(async (panel) => {
        // Skip if no narration
        if (!panel.narration) {
          return panel;
        }

        try {
          const url = new URL(buildApiUrl('/api/voice-over/generate-voiceover'));
          url.searchParams.append('narration', panel.narration);

          const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            return panel;
          }

          const audioData = await response.json();

          return {
            ...panel,
            audio_data: audioData.audio
          };
        } catch (error) {
          return panel;
        }
      })
    );

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
      const panelsWithAudio = await generateAudioForPanels();
      
      const payload = {
        title: title.trim(),
        description: description.trim(),
        is_public: isPublic,
        tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
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
      router.push('/protected/comics');

    } catch (error) {
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

        <div className="grid grid-cols-1 lg:grid-cols-[60%_40%] gap-8">
          {/* Left Side - Comic Preview */}
          <div className="space-y-6">
            <div className="bg-background-card rounded-xl p-6 border border-border">
              <h2 className="text-xl font-bold text-foreground mb-4">Comic Preview</h2>
              
              {/* Panels Preview - 2x3 Grid */}
              <div className="grid grid-cols-2 gap-4">
                {panelsData.map((panel) => (
                  <div 
                    key={panel.id}
                    className="bg-background-tertiary rounded-lg border-2 border-black overflow-hidden"
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
                    </div>
                    
                    {/* Panel Narration - Editable */}
                    <div className="p-3 border-t border-border">
                      <div className="text-xs font-medium text-foreground-secondary mb-1 flex items-center justify-between">
                        <span>Narration:</span>
                        <svg className="w-3 h-3 text-foreground-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
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
                          placeholder="Edit narration for this panel..."
                          className="w-full text-xs text-foreground bg-background-secondary rounded p-2 border border-border hover:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none transition-colors"
                          rows={2}
                        />
                      ) : (
                        <textarea
                          value=""
                          onChange={(e) => {
                            const updatedPanels = panelsData.map(p =>
                              p.id === panel.id ? { ...p, narration: e.target.value } : p
                            );
                            setPanelsData(updatedPanels);
                          }}
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
            {/* Generate Thumbnail Section */}
            <div className="bg-background-card rounded-xl p-6 border border-border">
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
                  <p className="text-xs text-foreground-muted mt-2">This thumbnail will be used as your comic cover</p>
                </div>
              )}
            </div>

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

            {/* Generation Actions */}
            <div className="bg-background-card rounded-xl p-6 border border-border">
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
              </div>
            </div>

            {/* Publish Section */}
            <div className="bg-background-card rounded-xl p-6 border border-border">
              <h2 className="text-xl font-bold text-foreground mb-4">Publish Comic</h2>
              
              {/* Publishing Checklist */}
              <div className="mb-4 p-4 bg-background-tertiary rounded-lg border border-border">
                <p className="text-sm font-medium text-foreground mb-3">Before Publishing:</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2">
                    {title.trim() ? (
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-foreground-muted flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className={title.trim() ? 'text-foreground' : 'text-foreground-muted'}>
                      Add comic title
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {thumbnailData ? (
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-foreground-muted flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className={thumbnailData ? 'text-foreground' : 'text-foreground-muted'}>
                      Generate thumbnail
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {panelsData.every(p => p.narration) ? (
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-foreground-muted flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className={panelsData.every(p => p.narration) ? 'text-foreground' : 'text-foreground-muted'}>
                      Generate narrations for all panels
                    </span>
                  </div>
                </div>
                
                {(!title.trim() || !thumbnailData || !panelsData.every(p => p.narration)) && (
                  <p className="mt-3 text-xs text-foreground-muted italic">
                    Complete all items above to enable publishing
                  </p>
                )}
              </div>
              
              {error && (
                <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg">
                  <p className="text-error text-sm">{error}</p>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={handleSaveComic}
                  disabled={loading || !title.trim() || !thumbnailData || !panelsData.every(p => p.narration)}
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