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

  // Load comic data from sessionStorage
  useEffect(() => {
    try {
      const storedPanelsData = sessionStorage.getItem('comicPanelsData');
      const storedTitle = sessionStorage.getItem('comicTitle');
      
      if (storedPanelsData) {
        const panels = JSON.parse(storedPanelsData);
        setPanelsData(panels);
      } else {
        setError('No comic data found. Please go back to create a comic.');
        return;
      }
      
      if (storedTitle) {
        setTitle(storedTitle);
      }
    } catch (error) {
      console.error('Error loading comic data:', error);
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
      
      const payload = {
        title: title.trim(),
        description: description.trim(),
        is_public: isPublic,
        tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
        panels: panelsData
      };

      console.log('🔍 DEBUG: Saving comic with payload:', payload);

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
      sessionStorage.removeItem('comicTitle');

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
            <Link href="/protected" className="hover:text-foreground transition-colors">Explore</Link>
            <span>›</span>
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
                <h3 className="text-2xl font-bold text-foreground text-center">
                  {title || 'Untitled Comic'}
                </h3>
              </div>

              {/* Panels Preview */}
              <div className="grid grid-cols-2 gap-4">
                {panelsData.map((panel) => (
                  <div 
                    key={panel.id}
                    className="aspect-[4/3] bg-background-tertiary rounded-lg border-2 border-black overflow-hidden"
                  >
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
                ))}
              </div>

              {/* Panel count */}
              <div className="mt-4 text-center">
                <p className="text-sm text-foreground-secondary">
                  {panelsData.length} panel{panelsData.length !== 1 ? 's' : ''} ready to publish
                </p>
              </div>
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
                  <p className="text-xs text-foreground-muted mt-1">{title.length}/100 characters</p>
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-foreground-secondary mb-2">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background-secondary text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none"
                    placeholder="Describe your comic story..."
                    maxLength={500}
                  />
                  <p className="text-xs text-foreground-muted mt-1">{description.length}/500 characters</p>
                </div>

                {/* Tags */}
                <div>
                  <label htmlFor="tags" className="block text-sm font-medium text-foreground-secondary mb-2">
                    Tags
                  </label>
                  <input
                    type="text"
                    id="tags"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background-secondary text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                    placeholder="adventure, comedy, action (comma separated)"
                  />
                  <p className="text-xs text-foreground-muted mt-1">Separate tags with commas</p>
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
                      <span>Publishing...</span>
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