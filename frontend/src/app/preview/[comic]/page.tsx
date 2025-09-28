'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { buildApiUrl, API_CONFIG } from '@/config/api';
import { useAuth } from '@/components/auth/AuthProvider';
import { createClient } from '@/lib/supabase/client';

interface ComicPanel {
  id: string;
  panel_number: number;
  display_number: number;
  public_url: string;
  storage_path: string;
  file_size: number;
  created_at: string;
}

interface ComicData {
  success: boolean;
  panels: ComicPanel[];
  title: string;
}

export default function ComicPreview() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();
  const [comicData, setComicData] = useState<ComicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPanel, setSelectedPanel] = useState<ComicPanel | null>(null);
  const [selectedPanelIndex, setSelectedPanelIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'grid' | 'clickthrough'>('grid');
  const [currentPanelIndex, setCurrentPanelIndex] = useState(0);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const comicId = params.comic as string;

  useEffect(() => {
    if (comicId) {
      loadComic();
    }
  }, [comicId]);

  // Close settings menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSettingsMenu) {
        const target = event.target as Element;
        if (!target.closest('.settings-menu')) {
          setShowSettingsMenu(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettingsMenu]);

  const loadComic = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading comic with ID:', comicId);
      
      // First try to get the comic from public comics
      let response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.PUBLIC_COMICS));
      
      if (response.ok) {
        const publicData = await response.json();
        console.log('Public comics data:', publicData);
        
        if (publicData.comics && Array.isArray(publicData.comics)) {
          const comic = publicData.comics.find((c: any) => c.id === comicId);
          if (comic) {
            console.log('Found comic in public comics:', comic);
            console.log('Comic ID:', comic.id, 'Looking for:', comicId);
            console.log('All panels:', comic.panels || comic.comic_panels);
            // Transform the database comic data to match the expected format
            // Filter out cover (panel 0) and sort panels 1-6 for display
            const allPanels = comic.panels || comic.comic_panels || [];
            const panels = allPanels
              .filter((panel: any) => panel.panel_number >= 1) // Only panels 1-6, exclude cover (0)
              .sort((a: any, b: any) => a.panel_number - b.panel_number)
              .map((panel: any, index: number) => ({
                ...panel,
                display_number: index + 1 // Display as 1, 2, 3, 4, 5, 6
              }));
            console.log('Filtered panels (1-6):', panels);
            const transformedComic = {
              success: true,
              title: comic.title,
              panels: panels
            };
            setComicData(transformedComic);
            return;
          }
        }
      }
      
      // If not found in public comics and user is logged in, try user comics
      if (user) {
        console.log('Comic not found in public comics, trying user comics...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.access_token) {
          response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.USER_COMICS), {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            console.log('User comics data:', userData);
            
            if (userData.comics && Array.isArray(userData.comics)) {
              const comic = userData.comics.find((c: any) => c.id === comicId);
              if (comic) {
                console.log('Found comic in user comics:', comic);
                console.log('Comic ID:', comic.id, 'Looking for:', comicId);
                console.log('All panels:', comic.panels || comic.comic_panels);
                // Transform the database comic data to match the expected format
                // Filter out cover (panel 0) and sort panels 1-6 for display
                const allPanels = comic.panels || comic.comic_panels || [];
                const panels = allPanels
                  .filter((panel: any) => panel.panel_number >= 1) // Only panels 1-6, exclude cover (0)
                  .sort((a: any, b: any) => a.panel_number - b.panel_number)
                  .map((panel: any, index: number) => ({
                    ...panel,
                    display_number: index + 1 // Display as 1, 2, 3, 4, 5, 6
                  }));
                console.log('Filtered panels (1-6):', panels);
                const transformedComic = {
                  success: true,
                  title: comic.title,
                  panels: panels
                };
                setComicData(transformedComic);
                return;
              }
            }
          }
        }
      }
      
      // If not found in database, throw error
      throw new Error(`Comic with ID "${comicId}" not found in database`);
      
    } catch (err) {
      console.error('Error loading comic:', err);
      setError(err instanceof Error ? err.message : 'Failed to load comic');
    } finally {
      setLoading(false);
    }
  };

  const handlePanelClick = (panel: ComicPanel, index: number) => {
    if (viewMode === 'grid') {
      // Switch to clickthrough view and set the clicked panel as current
      setCurrentPanelIndex(index);
      setViewMode('clickthrough');
    } else {
      // In clickthrough mode, open the enlarged modal
      setSelectedPanel(panel);
      setSelectedPanelIndex(index);
    }
  };

  const closeEnlargedView = () => {
    setSelectedPanel(null);
  };

  const nextPanel = () => {
    if (comicData && currentPanelIndex < comicData.panels.length - 1) {
      setCurrentPanelIndex(currentPanelIndex + 1);
    }
  };

  const prevPanel = () => {
    if (currentPanelIndex > 0) {
      setCurrentPanelIndex(currentPanelIndex - 1);
    }
  };

  const goToPanel = (index: number) => {
    setCurrentPanelIndex(index);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-900 to-stone-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-200 mx-auto mb-4"></div>
          <p className="text-amber-50">Loading comic...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-900 to-stone-800 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-amber-50 mb-4">Error Loading Comic</h1>
          <p className="text-stone-200 mb-6">{error}</p>
          <Link href="/">
            <button className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
              Back to Home
            </button>
          </Link>
        </div>
      </div>
    );
  }

  if (!comicData || comicData.panels.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-900 to-stone-800 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-amber-400 text-6xl mb-4">📖</div>
          <h1 className="text-2xl font-bold text-amber-50 mb-4">No Comic Found</h1>
          <p className="text-stone-200 mb-6">This comic doesn't exist or has no panels.</p>
          <Link href="/">
            <button className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
              Back to Home
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const formatComicTitle = (title: string | undefined): string => {
    if (!title) return 'Unknown Comic';
    return title
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const handleDeleteComic = async () => {
    if (!user || !comicId) return;
    
    try {
      setIsDeleting(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        alert('You must be logged in to delete comics');
        return;
      }

      const response = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.USER_COMICS}/${comicId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        alert('Comic deleted successfully!');
        router.push('/protected/comics');
      } else {
        const errorData = await response.json();
        alert(`Failed to delete comic: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting comic:', error);
      alert('Failed to delete comic. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setShowSettingsMenu(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-900 to-stone-800">
      {/* Header */}
      <div className="bg-stone-800/50 backdrop-blur-sm border-b border-stone-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <button className="flex items-center space-x-2 text-amber-50 hover:text-amber-200 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Back to Home</span>
                </button>
              </Link>
              <div className="h-6 w-px bg-stone-600"></div>
              <h1 className="text-xl font-bold text-amber-50">
                {formatComicTitle(comicData?.title || comicId)}
              </h1>
            </div>
            
            {/* Back to Grid Button - Only show in clickthrough mode */}
            {viewMode === 'clickthrough' && (
              <button
                onClick={() => setViewMode('grid')}
                className="flex items-center space-x-2 px-3 py-1 bg-stone-700/50 text-stone-200 rounded-md hover:bg-stone-600/50 transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span>Grid</span>
              </button>
            )}
            
            {/* Edit and Settings Buttons - Only show for authenticated users */}
            {user && (
              <div className="flex items-center space-x-2">
                {/* Edit Button */}
                <button
                  onClick={() => router.push(`/protected/create?edit=${comicId}`)}
                  className="flex items-center space-x-2 px-3 py-1 rounded-md transition-colors text-sm"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--foreground-on-accent)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--accent)';
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Edit</span>
                </button>

                {/* Settings Button */}
                <div className="relative settings-menu">
                  <button
                    onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                    className="flex items-center space-x-2 px-3 py-1 bg-stone-700/50 text-stone-200 rounded-md hover:bg-stone-600/50 transition-colors text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Settings</span>
                  </button>
                  
                  {/* Settings Dropdown */}
                  {showSettingsMenu && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-stone-800 border border-stone-600 rounded-md shadow-lg z-50">
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="w-full px-4 py-2 text-left text-red-400 hover:bg-red-600/20 transition-colors text-sm flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete Comic</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {!user && (
              <div className="flex items-center space-x-4">
                <Link href="/auth/login">
                  <button className="px-4 py-2 text-sm bg-stone-700/50 text-stone-200 rounded-md hover:bg-stone-600/50 transition-colors">
                    Sign In
                  </button>
                </Link>
                <Link href="/auth/signup">
                  <button className="px-4 py-2 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors">
                    Sign Up
                  </button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comic Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {viewMode === 'grid' ? (
          /* Grid View */
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {comicData.panels.map((panel, index) => (
              <div
                key={`${panel.id}-${panel.panel_number}` || `panel-${index}`}
                className="group relative bg-stone-800/60 backdrop-blur-sm overflow-hidden shadow-2xl hover:shadow-amber-200/20 hover:scale-[1.02] transition-all duration-300 transform-gpu border border-stone-700/50 cursor-pointer"
                onClick={() => handlePanelClick(panel, index)}
              >
                {/* Panel Image */}
                <div className="relative aspect-[4/3] w-full">
                  {panel.public_url ? (
                    <Image
                      src={panel.public_url}
                      alt={`Panel ${panel.display_number}`}
                      fill
                      className="object-cover"
                      priority={index < 3} // Prioritize first 3 images
                    />
                  ) : (
                    <div className="w-full h-full bg-background-tertiary flex items-center justify-center">
                      <div className="text-foreground-muted text-center">
                        <div className="text-xl mb-1">🖼️</div>
                        <div className="text-xs">No image</div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Hover Effect Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-200/10 to-amber-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              </div>
            ))}
          </div>
        ) : (
          /* Clickthrough View */
          <div className="w-full">
            {/* Current Panel Display with Side Navigation */}
            <div className="w-full flex items-center justify-center space-x-8 mb-8">
              {/* Previous Button */}
              <button
                onClick={prevPanel}
                disabled={currentPanelIndex === 0}
                className="flex items-center justify-center w-12 h-12 bg-stone-700/50 text-stone-200 rounded-full hover:bg-stone-600/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Panel Container */}
              <div className="max-w-4xl w-full">
                <div
                  className="group relative bg-stone-800/60 backdrop-blur-sm overflow-hidden shadow-2xl hover:shadow-amber-200/20 hover:scale-[1.02] transition-all duration-300 transform-gpu border border-stone-700/50 cursor-pointer"
                  onClick={() => handlePanelClick(comicData.panels[currentPanelIndex], currentPanelIndex)}
                >
                  {/* Panel Image */}
                  <div className="relative aspect-[4/3] w-full">
                    {comicData.panels[currentPanelIndex].public_url ? (
                      <Image
                        src={comicData.panels[currentPanelIndex].public_url}
                        alt={`Panel ${comicData.panels[currentPanelIndex].display_number}`}
                        fill
                        className="object-cover"
                        priority
                      />
                    ) : (
                      <div className="w-full h-full bg-background-tertiary flex items-center justify-center">
                        <div className="text-foreground-muted text-center">
                          <div className="text-xl mb-1">🖼️</div>
                          <div className="text-xs">No image</div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Hover Effect Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-200/10 to-amber-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </div>
              </div>

              {/* Next Button */}
              <button
                onClick={nextPanel}
                disabled={currentPanelIndex === comicData.panels.length - 1}
                className="flex items-center justify-center w-12 h-12 bg-stone-700/50 text-stone-200 rounded-full hover:bg-stone-600/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Panel Counter */}
            <div className="text-center mb-8">
              <p className="text-stone-200 text-sm">
                Panel {currentPanelIndex + 1} of {comicData.panels.length}
              </p>
            </div>

            {/* Panel Thumbnails */}
            <div className="flex justify-center space-x-2 mb-8">
              {comicData.panels.map((panel, index) => (
                <button
                  key={`${panel.id}-${panel.panel_number}` || `panel-${index}`}
                  onClick={() => goToPanel(index)}
                  className={`relative w-16 h-12 overflow-hidden transition-all duration-200 ${
                    index === currentPanelIndex
                      ? 'ring-2 ring-amber-400 scale-110'
                      : 'hover:scale-105 opacity-70 hover:opacity-100'
                  }`}
                >
                  {panel.public_url ? (
                    <Image
                      src={panel.public_url}
                      alt={`Panel ${index + 1} thumbnail`}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-background-tertiary flex items-center justify-center">
                      <div className="text-foreground-muted text-center">
                        <div className="text-xs">No image</div>
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Call to Action - Only show for non-authenticated users */}
        {!user && (
          <div className="text-center bg-stone-800/30 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-amber-50 mb-4">
              Love what you see?
            </h2>
            <p className="text-stone-200 mb-6">
              Sign up to create your own amazing comics with AI!
            </p>
            <div className="flex justify-center space-x-4">
              <Link href="/auth/signup">
                <button className="px-8 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium">
                  Create Your Comic
                </button>
              </Link>
              <Link href="/auth/login">
                <button className="px-8 py-3 bg-stone-700/50 text-stone-200 rounded-lg hover:bg-stone-600/50 transition-colors font-medium">
                  Sign In
                </button>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Enlarged Panel Modal */}
      {selectedPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300"
            onClick={closeEnlargedView}
          />
          
          {/* Modal Content */}
          <div className="relative bg-stone-800/90 backdrop-blur-sm rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden transform transition-all duration-300 scale-100">
            {/* Close Button */}
            <button
              onClick={closeEnlargedView}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/20 hover:bg-black/30 rounded-full flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Panel Content */}
            <div className="p-6">
              {/* Panel Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-amber-50 flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-500/80 backdrop-blur-sm rounded-full flex items-center justify-center text-sm font-bold text-stone-900 shadow-lg">
                  {selectedPanel.display_number}
                </div>
                Panel {selectedPanel.display_number}
                </h2>
                <div className="text-stone-300 text-sm">
                  {selectedPanelIndex + 1} of {comicData.panels.length}
                </div>
              </div>

              {/* Panel Image */}
              <div className="relative aspect-[4/3] w-full max-w-3xl mx-auto">
                {selectedPanel.public_url ? (
                  <Image
                    src={selectedPanel.public_url}
                        alt={`Panel ${selectedPanel.display_number}`}
                    fill
                    className="object-contain"
                    priority
                  />
                ) : (
                  <div className="w-full h-full bg-background-tertiary flex items-center justify-center">
                    <div className="text-foreground-muted text-center">
                      <div className="text-xl mb-1">🖼️</div>
                      <div className="text-xs">No image</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="flex justify-center mt-6 space-x-4">
                <button
                  onClick={() => {
                    const prevIndex = selectedPanelIndex > 0 ? selectedPanelIndex - 1 : comicData.panels.length - 1;
                    setSelectedPanel(comicData.panels[prevIndex]);
                    setSelectedPanelIndex(prevIndex);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-stone-700/50 text-stone-200 rounded-lg hover:bg-stone-600/50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Previous</span>
                </button>

                <button
                  onClick={() => {
                    const nextIndex = selectedPanelIndex < comicData.panels.length - 1 ? selectedPanelIndex + 1 : 0;
                    setSelectedPanel(comicData.panels[nextIndex]);
                    setSelectedPanelIndex(nextIndex);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-stone-700/50 text-stone-200 rounded-lg hover:bg-stone-600/50 transition-colors"
                >
                  <span>Next</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-stone-800 border border-stone-600 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-amber-50 mb-4">Delete Comic</h3>
            <p className="text-stone-200 mb-6">
              Are you sure you want to delete "{formatComicTitle(comicData?.title || comicId)}"? 
              This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setShowSettingsMenu(false);
                }}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-stone-700 text-stone-200 rounded-md hover:bg-stone-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteComic}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
