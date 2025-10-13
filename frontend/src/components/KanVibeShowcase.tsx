'use client';

import React, { useState } from 'react';
import Image from 'next/image';

interface KanVibeShowcaseProps {
  onOpenModal?: () => void;
}

const SCENES = [1, 2, 3, 4, 5, 6];

export default function KanVibeShowcase({ onOpenModal }: KanVibeShowcaseProps) {
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

  return (
    <div
      className="group relative bg-background-card overflow-hidden cursor-pointer hover:ring-2 hover:ring-accent transition-all duration-200 hover:scale-[1.02]"
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

      {/* Title and info at bottom with overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-3">
        <h3 className="text-white font-semibold text-sm mb-1 line-clamp-2 leading-tight">Kan Vibe</h3>
        <div className="flex items-center justify-between text-xs">
          <p className="text-foreground-secondary font-medium">
            AI Tinkerers
          </p>
          <p className="text-foreground-secondary">
            {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
}


