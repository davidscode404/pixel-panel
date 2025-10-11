'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { API_CONFIG, buildApiUrl } from '@/config/api';
import ComicDetailModal from '@/components/ComicDetailModal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import KanVibeShowcase from '@/components/KanVibeShowcase';
import KanVibeModal from '@/components/KanVibeModal';
import type { Comic, ComicPanel } from '@/types';

export default function ExplorePage() {
  const [comics, setComics] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedComic, setSelectedComic] = useState<Comic | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [imageLoading, setImageLoading] = useState<{[key: string]: boolean}>({});
  const [imageErrors, setImageErrors] = useState<{[key: string]: boolean}>({});
  const [showKanVibeModal, setShowKanVibeModal] = useState(false);
  const [kanVibeAutoPlay, setKanVibeAutoPlay] = useState(false);

  // Fetch public comics on component mount
  useEffect(() => {
    fetchPublicComics();
  }, []);

  const fetchPublicComics = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.PUBLIC_COMICS), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.comics && Array.isArray(data.comics)) {
        // Process comics data to ensure panels are properly structured
        const processedComics = data.comics
          .filter((comic: Comic & { comic_panels?: ComicPanel[] }) => comic.is_public === true) // Ensure only public comics
          .map((comic: Comic & { comic_panels?: ComicPanel[] }) => ({
            ...comic,
            panels: comic.comic_panels || comic.panels || []
          }));
        
        setComics(processedComics);
      } else {
        setComics([]);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load public comics');
      setComics([]);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (comic: Comic) => {
    setSelectedComic(comic);
    setAutoPlay(false);
    setShowModal(true);
  };

  const openModalAndPlay = (comic: Comic, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent the card click from firing
    setSelectedComic(comic);
    setAutoPlay(true);
    setShowModal(true);
  };

  const openKanVibeModal = () => {
    setKanVibeAutoPlay(false);
    setShowKanVibeModal(true);
  };

  const openKanVibeModalAndPlay = () => {
    setKanVibeAutoPlay(true);
    setShowKanVibeModal(true);
  };

  const closeKanVibeModal = () => {
    setShowKanVibeModal(false);
    setKanVibeAutoPlay(false);
  };

  const closeModal = () => {
    setSelectedComic(null);
    setShowModal(false);
    setAutoPlay(false);
  };

  const handleImageLoadStart = (key: string) => {
    setImageLoading(prev => ({ ...prev, [key]: true }));
    setImageErrors(prev => ({ ...prev, [key]: false }));
  };

  const handleImageLoad = (key: string) => {
    setImageLoading(prev => ({ ...prev, [key]: false }));
    setImageErrors(prev => ({ ...prev, [key]: false }));
  };

  const handleImageError = (key: string) => {
    setImageLoading(prev => ({ ...prev, [key]: false }));
    setImageErrors(prev => ({ ...prev, [key]: true }));
  };

  if (loading) {
    return (
      <div className="w-full h-full">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-foreground">Explore Comics</h1>
          <p className="text-foreground-secondary">Discover comics created by the community</p>
        </div>
        <LoadingSpinner message="Loading public comics..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-foreground">Explore Comics</h1>
          <p className="text-foreground-secondary">Discover comics created by the community</p>
        </div>
        <div className="text-center py-12">
          <div className="text-error mb-4">❌ Error loading comics</div>
          <p className="text-foreground-secondary mb-4">{error}</p>
          <button 
            onClick={fetchPublicComics}
            className="bg-accent hover:bg-accent-hover px-4 py-2 rounded-lg transition-colors text-foreground-inverse"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto scrollbar-hide">
      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>Explore Comics</h1>
          <p style={{ color: 'var(--foreground-secondary)' }}>Discover comics created by the community</p>
        </div>

        {comics.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>No Public Comics Yet</h2>
              <p className="mb-6" style={{ color: 'var(--foreground-secondary)' }}>Be the first to share your comic with the community!</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 w-full">
          {/* Kan Vibe Featured Card */}
          <KanVibeShowcase 
            onOpenModal={openKanVibeModal}
            onOpenModalAndPlay={openKanVibeModalAndPlay}
          />
          
          {comics.map((comic) => {
            return (
            <div
              key={comic.id}
              className="group relative bg-background-card overflow-hidden cursor-pointer hover:ring-2 hover:ring-accent transition-all duration-200 hover:scale-[1.02] border-4 border-black"
              onClick={() => openModal(comic)}
            >
              {/* Image */}
              <div className="relative w-full aspect-[3/4]">
                {imageLoading[`${comic.id}-preview`] && (
                  <div className="absolute inset-0 bg-background-tertiary flex items-center justify-center z-10">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
                  </div>
                )}
                {imageErrors[`${comic.id}-preview`] ? (
                  <div className="w-full h-full bg-background-tertiary flex items-center justify-center">
                    <div className="text-foreground-muted text-center">
                      <div className="text-sm">No image</div>
                    </div>
                  </div>
                ) : (
                  (() => {
                    const imageUrl = comic.panels.find(p => p.panel_number === 0)?.public_url || 
                                    comic.panels.find(p => p.panel_number === 1)?.public_url ||
                                    comic.panels[0]?.public_url ||
                                    '/placeholder-comic.png';
                    
                    if (imageUrl.startsWith('http')) {
                      return (
                        <Image
                          src={imageUrl}
                          alt={comic.title}
                          width={400}
                          height={300}
                          className="w-full h-full object-cover"
                          onLoad={() => handleImageLoad(`${comic.id}-preview`)}
                          onError={() => handleImageError(`${comic.id}-preview`)}
                          onLoadStart={() => handleImageLoadStart(`${comic.id}-preview`)}
                        />
                      );
                    } else {
                      return (
                        <Image
                          src={imageUrl}
                          alt={comic.title}
                          className="w-full h-full object-cover"
                          onLoad={() => handleImageLoad(`${comic.id}-preview`)}
                          onError={() => handleImageError(`${comic.id}-preview`)}
                          onLoadStart={() => handleImageLoadStart(`${comic.id}-preview`)}
                        />
                      );
                    }
                  })()
                )}
              </div>

              {/* Play button overlay - only show if comic has audio */}
              {comic.panels.some(p => p.audio_url && p.panel_number > 0) && (
                <div className="absolute top-3 right-3">
                  <button
                    onClick={(e) => openModalAndPlay(comic, e)}
                    className="bg-accent hover:bg-accent-hover text-white rounded-full p-2 transition-all duration-200 hover:scale-110 shadow-lg"
                    aria-label="Play comic"
                    title="Play comic with audio"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Title, author, and date at bottom with overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-3">
                <h3 className="text-white font-semibold text-sm mb-1 line-clamp-2 leading-tight">{comic.title}</h3>
                <div className="flex items-center justify-between text-xs">
                  <p className="text-white/80 font-medium">
                    {comic.user_profiles?.name || 'Anonymous'}
                  </p>
                  <p className="text-foreground-secondary">
                    {new Date(comic.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>

            </div>
            );
          })}
          </div>
        )}

        {/* Modal for viewing comic details */}
        {selectedComic && (
          <ComicDetailModal
            comic={selectedComic}
            isOpen={showModal}
            onClose={closeModal}
            autoPlay={autoPlay}
          />
        )}

        {/* Kan Vibe Modal */}
        <KanVibeModal
          isOpen={showKanVibeModal}
          onClose={closeKanVibeModal}
          autoPlay={kanVibeAutoPlay}
        />
      </div>
    </div>
  );
}