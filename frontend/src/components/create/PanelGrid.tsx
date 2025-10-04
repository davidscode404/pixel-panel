"use client";

import React from 'react';

interface PanelItem {
  id: number;
  isEnabled: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

interface PanelGridProps {
  panels: PanelItem[];
  onPanelClick: (panelId: number) => void;
  onClearPanel: (panelId: number) => void;
}

export default function PanelGrid({ panels, onPanelClick, onClearPanel }: PanelGridProps) {
  return (
    <div className="w-full h-full grid grid-cols-3 gap-6">
      {panels.map((panel) => (
        <div
          key={panel.id}
          data-panel-id={panel.id}
          className={`group relative bg-background-card backdrop-blur-sm transition-all duration-300 transform-gpu border-4 ${
            panel.isEnabled
              ? 'cursor-pointer hover:bg-background-tertiary hover:scale-[1.02] border-black'
              : 'cursor-not-allowed opacity-40 border-gray-400'
          }`}
          style={{ aspectRatio: '4/3' }}
          onClick={() => onPanelClick(panel.id)}
        >
          <canvas
            ref={panel.canvasRef as React.RefObject<HTMLCanvasElement>}
            width={400}
            height={300}
            className="w-full h-full pointer-events-none bg-white"
            style={{ width: '100%', height: '100%', display: 'block' }}
          />

          <div className="absolute top-2 left-2 w-6 h-6 bg-accent backdrop-blur-sm flex items-center justify-center text-xs font-bold text-foreground-inverse group-hover:bg-accent-light transition-colors duration-300 border-2 border-black">
            {panel.id}
          </div>

          {!panel.isEnabled && (
            <div className="absolute inset-0 bg-white/60 pointer-events-none" />
          )}

          {panel.isEnabled && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClearPanel(panel.id);
              }}
              className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 backdrop-blur-sm flex items-center justify-center text-white hover:bg-red-600/90 transition-colors duration-300 opacity-0 group-hover:opacity-100 border-2 border-black"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}

          {panel.isEnabled && (
            <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-accent-light/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          )}
        </div>
      ))}
    </div>
  );
}


