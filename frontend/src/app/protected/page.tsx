'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { API_CONFIG, buildApiUrl } from '@/config/api';
import ComicDetailModal from '@/components/ComicDetailModal';

interface ComicPanel {
  id: string;
  panel_number: number;
  public_url: string;
  storage_path: string;
  file_size: number;
  created_at: string;
  narration?: string;
  audio_url?: string;
}

interface Comic {
  id: string;
  title: string;
  user_id: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  panels: ComicPanel[];
}

export default function ExplorePage() {
  const [comics, setComics] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedComic, setSelectedComic] = useState<Comic | null>(null);
  const [imageLoading, setImageLoading] = useState<{[key: string]: boolean}>({});
  const [imageErrors, setImageErrors] = useState<{[key: string]: boolean}>({});
  const [showModal, setShowModal] = useState(false);

  // Fetch public comics on component mount
  useEffect(() => {
    fetchPublicComics();
  }, []);

  const fetchPublicComics = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 DEBUG: Fetching public comics...');

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
      console.log('✅ Public comics data:', data);

      if (data.comics && Array.isArray(data.comics)) {
        // Process comics data to ensure panels are properly structured
        const processedComics = data.comics.map((comic: Comic & { comic_panels?: ComicPanel[] }) => ({
          ...comic,
          panels: comic.comic_panels || comic.panels || []
        }));
        
        setComics(processedComics);
        console.log(`📚 Loaded ${processedComics.length} public comics`);
      } else {
        console.warn('⚠️ No comics data in response');
        setComics([]);
      }
    } catch (error) {
      console.error('❌ Error fetching public comics:', error);
      setError(error instanceof Error ? error.message : 'Failed to load public comics');
      setComics([]);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (comic: Comic) => {
    setSelectedComic(comic);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedComic(null);
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
    console.warn(`⚠️ Failed to load image: ${key}`);
  };

  if (loading) {
    return (
      <div className="w-full h-full">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-foreground">Explore Comics</h1>
          <p className="text-foreground-secondary">Discover comics created by the community</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          <span className="ml-3 text-foreground-secondary">Loading public comics...</span>
        </div>
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
    <div className="w-full h-full">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-foreground">Explore Comics</h1>
        <p className="text-foreground-secondary">Discover comics created by the community</p>
      </div>

      {comics.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-xl font-semibold mb-2 text-foreground">No Public Comics Yet</h2>
          <p className="text-foreground-secondary">Be the first to share your comic with the community!</p>
        </div>
      ) : (
        <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-3 gap-4 space-y-4 w-full">
          {comics.map((comic, index) => {
            console.log('Rendering public comic:', comic.title, 'Panels:', comic.panels?.length || 0);
            // Create varying heights for comic-like layout - made taller for wider cards
            const heights = ['h-64', 'h-80', 'h-72', 'h-96', 'h-56', 'h-[400px]']
            const randomHeight = heights[index % heights.length]
            
            return (
            <div
              key={comic.id}
              className={`group bg-background-card border-4 border-black overflow-hidden hover:border-accent transition-colors relative break-inside-avoid mb-4 cursor-pointer ${randomHeight}`}
              onClick={() => openModal(comic)}
            >
              {/* Image */}
              <div className="relative w-full h-full">
                {imageLoading[`${comic.id}-preview`] && (
                  <div className="absolute inset-0 bg-background-tertiary flex items-center justify-center z-10">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
                  </div>
                )}
                {imageErrors[`${comic.id}-preview`] ? (
                  <div className="w-full h-full bg-background-tertiary flex items-center justify-center">
                    <div className="text-foreground-muted text-center">
                      <div className="text-xl mb-1">🖼️</div>
                      <div className="text-xs">No image</div>
                    </div>
                  </div>
                ) : (
                   <Image
                      src={
                        comic.panels.find(p => p.panel_number === 0)?.public_url || 
                        comic.panels.find(p => p.panel_number === 1)?.public_url ||
                        comic.panels[0]?.public_url ||
                        '/placeholder-comic.png'
                      }
                      alt={comic.title}
                      width={400}
                      height={300}
                      className="w-full h-full object-cover"
                      onLoad={() => handleImageLoad(`${comic.id}-preview`)}
                      onError={() => handleImageError(`${comic.id}-preview`)}
                      onLoadStart={() => handleImageLoadStart(`${comic.id}-preview`)}
                    />
                )}
              </div>

              {/* Details overlay - only visible on hover */}
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                <h3 className="text-sm font-semibold text-foreground-inverse mb-1">{comic.title}</h3>
                <p className="text-foreground-secondary text-xs mb-1">By Creator</p>
                <div className="flex items-center justify-between">
                  <span className="text-foreground-muted text-xs">
                    {new Date(comic.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex items-center space-x-1">
                    <svg className="w-3 h-3 text-accent" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="text-foreground-muted text-xs">{comic.panels.length}</span>
                  </div>
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
          />
        )}
    </div>
  );
}
