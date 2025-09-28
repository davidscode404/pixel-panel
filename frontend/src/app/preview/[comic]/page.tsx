'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { buildApiUrl, API_CONFIG } from '@/config/api';
import { useAuth } from '@/components/auth/AuthProvider';

interface ComicPanel {
  panel_number: number;
  image_data: string;
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
  const [comicData, setComicData] = useState<ComicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPanel, setSelectedPanel] = useState<ComicPanel | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'clickthrough'>('grid');
  const [currentPanelIndex, setCurrentPanelIndex] = useState(0);

  const comicTitle = params.comic as string;

  useEffect(() => {
    if (comicTitle) {
      loadComic();
    }
  }, [comicTitle]);

  const loadComic = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const decodedTitle = decodeURIComponent(comicTitle);
      console.log('Loading comic with title:', decodedTitle);
      
      const response = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.LOAD_COMIC}/${encodeURIComponent(decodedTitle)}`));
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`Failed to load comic: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Comic data received:', data);
      setComicData(data);
    } catch (err) {
      console.error('Error loading comic:', err);
      setError(err instanceof Error ? err.message : 'Failed to load comic');
    } finally {
      setLoading(false);
    }
  };

  const handlePanelClick = (panel: ComicPanel) => {
    if (viewMode === 'grid') {
      // Switch to clickthrough view and set the clicked panel as current
      if (comicData) {
        const panelIndex = comicData.panels.findIndex(p => p.id === panel.id);
        setCurrentPanelIndex(panelIndex);
        setViewMode('clickthrough');
      }
    } else {
      // In clickthrough mode, open the enlarged modal
      setSelectedPanel(panel);
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
                {formatComicTitle(comicData?.title || comicTitle)}
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
                key={panel.panel_number || index}
                className="group relative bg-stone-800/60 backdrop-blur-sm rounded-lg overflow-hidden shadow-2xl hover:shadow-amber-200/20 hover:scale-[1.02] transition-all duration-300 transform-gpu border border-stone-700/50 cursor-pointer"
                onClick={() => handlePanelClick(panel)}
              >
                {/* Panel Image */}
                <div className="relative aspect-[4/3] w-full">
                  <Image
                    src={panel.image_data}
                    alt={`Panel ${panel.panel_number}`}
                    fill
                    className="object-cover rounded-lg"
                    priority={index < 3} // Prioritize first 3 images
                  />
                </div>
                
                {/* Hover Effect Overlay */}
                <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-amber-200/10 to-amber-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
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
                  className="group relative bg-stone-800/60 backdrop-blur-sm rounded-lg overflow-hidden shadow-2xl hover:shadow-amber-200/20 hover:scale-[1.02] transition-all duration-300 transform-gpu border border-stone-700/50 cursor-pointer"
                  onClick={() => handlePanelClick(comicData.panels[currentPanelIndex])}
                >
                  {/* Panel Image */}
                  <div className="relative aspect-[4/3] w-full">
                    <Image
                      src={comicData.panels[currentPanelIndex].image_data}
                      alt={`Panel ${comicData.panels[currentPanelIndex].id}`}
                      fill
                      className="object-cover rounded-lg"
                      priority
                    />
                  </div>
                  
                  {/* Hover Effect Overlay */}
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-amber-200/10 to-amber-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
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
                  key={panel.panel_number || index}
                  onClick={() => goToPanel(index)}
                  className={`relative w-16 h-12 rounded-lg overflow-hidden transition-all duration-200 ${
                    index === currentPanelIndex
                      ? 'ring-2 ring-amber-400 scale-110'
                      : 'hover:scale-105 opacity-70 hover:opacity-100'
                  }`}
                >
                  <Image
                    src={panel.image_data}
                    alt={`Panel ${index + 1} thumbnail`}
                    fill
                    className="object-cover"
                  />
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
                    {selectedPanel.id}
                  </div>
                  Panel {selectedPanel.id}
                </h2>
                <div className="text-stone-300 text-sm">
                  {comicData.panels.findIndex(p => p.id === selectedPanel.id) + 1} of {comicData.panels.length}
                </div>
              </div>

              {/* Panel Image */}
              <div className="relative aspect-[4/3] w-full max-w-3xl mx-auto">
                <Image
                  src={selectedPanel.image_data}
                  alt={`Panel ${selectedPanel.id}`}
                  fill
                  className="object-contain rounded-lg"
                  priority
                />
              </div>

              {/* Navigation */}
              <div className="flex justify-center mt-6 space-x-4">
                <button
                  onClick={() => {
                    const currentIndex = comicData.panels.findIndex(p => p.id === selectedPanel.id);
                    const prevIndex = currentIndex > 0 ? currentIndex - 1 : comicData.panels.length - 1;
                    setSelectedPanel(comicData.panels[prevIndex]);
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
                    const currentIndex = comicData.panels.findIndex(p => p.id === selectedPanel.id);
                    const nextIndex = currentIndex < comicData.panels.length - 1 ? currentIndex + 1 : 0;
                    setSelectedPanel(comicData.panels[nextIndex]);
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
    </div>
  );
}
