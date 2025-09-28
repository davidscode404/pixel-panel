'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { buildApiUrl, API_CONFIG, cachedFetch } from '@/config/api';

interface ComicData {
  title: string;
  panel_count: number;
  has_cover: boolean;
  cover_image?: string;
}

export default function ExplorePage() {
  const [comics, setComics] = useState<ComicData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadComics();
  }, []);

  const loadComics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await cachedFetch(buildApiUrl(API_CONFIG.ENDPOINTS.LIST_COMICS));
      
      if (!response.ok) {
        throw new Error(`Failed to load comics: ${response.statusText}`);
      }
      
      const data = await response.json();
      setComics(data.comics || []);
    } catch (err) {
      console.error('Error loading comics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load comics');
    } finally {
      setLoading(false);
    }
  };

  const formatComicTitle = (title: string): string => {
    return title
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-200 mx-auto mb-4"></div>
          <p className="text-amber-50">Loading comics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-amber-50 mb-4">Error Loading Comics</h2>
          <p className="text-stone-200 mb-6">{error}</p>
          <button 
            onClick={loadComics}
            className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (comics.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-amber-400 text-6xl mb-4">📖</div>
          <h2 className="text-2xl font-bold text-amber-50 mb-4">No Comics Found</h2>
          <p className="text-stone-200 mb-6">No comics have been created yet.</p>
          <Link href="/protected/create">
            <button className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
              Create First Comic
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full px-2">
      <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-1 space-y-1 w-full">
        {comics.map((comic, index) => {
          // Create varying heights for comic-like layout
          const heights = ['h-48', 'h-64', 'h-56', 'h-72', 'h-40', 'h-80'];
          const randomHeight = heights[index % heights.length];

          return (
            <Link 
              key={comic.title} 
              href={`/preview/${encodeURIComponent(comic.title)}`}
              className="block"
            >
              <div 
                className={`group bg-stone-800/50 rounded border border-stone-700/50 overflow-hidden hover:border-amber-500/50 transition-colors relative break-inside-avoid mb-1 ${randomHeight} cursor-pointer`}
              >
                {comic.cover_image ? (
                  <div className="w-full h-full relative">
                    {comic.cover_image.startsWith('data:') ? (
                      <img
                        src={comic.cover_image}
                        alt={formatComicTitle(comic.title)}
                        className="w-full h-full object-cover"
                      />
                    ) : comic.cover_image.startsWith('http') ? (
                      <Image
                        src={comic.cover_image}
                        alt={formatComicTitle(comic.title)}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                      />
                    ) : (
                      <img
                        src={`data:image/png;base64,${comic.cover_image}`}
                        alt={formatComicTitle(comic.title)}
                        className="w-full h-full object-cover"
                      />
                    )}
                    {/* Overlay for better text readability */}
                    <div className="absolute inset-0 bg-black/20" />
                  </div>
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-stone-600 to-stone-700 flex items-center justify-center">
                    <span className="text-stone-400 text-xs">{formatComicTitle(comic.title)}</span>
                  </div>
                )}
                
                {/* Details overlay - only visible on hover */}
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                  <h3 className="text-sm font-semibold text-amber-50 mb-1">
                    {formatComicTitle(comic.title)}
                  </h3>
                  <p className="text-stone-300 text-xs mb-1">By Community</p>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400 text-xs">{comic.panel_count} panels</span>
                    <div className="flex items-center space-x-1">
                      <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                      </svg>
                      <span className="text-stone-400 text-xs">{Math.floor(Math.random() * 50) + 1}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
