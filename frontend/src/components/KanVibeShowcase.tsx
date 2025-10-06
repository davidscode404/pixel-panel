'use client';

import React, { useState } from 'react';
import Image from 'next/image';

interface KanVibeShowcaseProps {
  onOpenModal?: () => void;
  onOpenModalAndPlay?: () => void;
}

const SCENES = [1, 2, 3, 4, 5, 6];

export default function KanVibeShowcase({ onOpenModal, onOpenModalAndPlay }: KanVibeShowcaseProps) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

  const handleCardClick = () => {
    if (onOpenModal) {
      onOpenModal();
    }
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenModalAndPlay) {
      onOpenModalAndPlay();
    }
  };

  return (
    <div
      className="group relative bg-background-card overflow-hidden cursor-pointer hover:ring-2 hover:ring-accent transition-all duration-200 hover:scale-[1.02] border-4 border-black"
      onClick={handleCardClick}
    >
      {/* Image */}
      <div className="relative w-full aspect-[3/4]">
        {imageLoading && (
          <div className="absolute inset-0 bg-background-tertiary flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
          </div>
        )}
        {imageError ? (
          <div className="w-full h-full bg-background-tertiary flex items-center justify-center">
            <div className="text-foreground-muted text-center">
              <div className="text-sm">No image</div>
            </div>
          </div>
        ) : (
          <video
            className="w-full h-full object-cover"
            preload="metadata"
            src="/saved-comics/kan_vibe/scene1.mp4#t=0.1"
            onLoadedData={handleImageLoad}
            onError={handleImageError}
            muted
          />
        )}
      </div>

      {/* Play button overlay */}
      <div className="absolute top-3 right-3">
        <button
          onClick={handlePlayClick}
          className="bg-accent hover:bg-accent-hover text-white rounded-full p-2 transition-all duration-200 hover:scale-110 shadow-lg"
          aria-label="Play Kan Vibe"
          title="Play Kan Vibe with audio"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      </div>

      {/* Title and info at bottom with overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-3">
        <h3 className="text-white font-semibold text-sm mb-1 line-clamp-2 leading-tight">Kan Vibe</h3>
        <div className="flex items-center justify-between text-xs">
          <p className="text-white/80 font-medium">
            Featured Comic
          </p>
          <p className="text-foreground-secondary">
            {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
}


