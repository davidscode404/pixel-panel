/**
 * Type definitions for the PixelPanel application
 * Centralized type definitions to avoid duplication across files
 */

import React from 'react';

// User types - compatible with Supabase User
export interface User {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

// Comic Panel types - Unified interface for all panel variations
export interface ComicPanel {
  // Database fields
  id: string | number;
  panel_number: number;
  public_url: string;
  storage_path?: string;
  file_size?: number;
  created_at?: string;
  comic_id?: string;
  
  // Content fields
  narration?: string;
  audio_url?: string;
  prompt?: string;
  image_data?: string;
  
  // Creation/editing fields
  is_zoomed?: boolean;
  isZoomed?: boolean; // Alternative naming for compatibility
  isEnabled?: boolean;
  
  // Canvas references (for create page)
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  smallCanvasData?: string | null;
  largeCanvasData?: string | null;
  
  // Display fields (for preview page)
  display_number?: number;
}

// Comic types - Unified interface for all comic variations
export interface Comic {
  id: string;
  title: string;
  user_id?: string;
  is_public?: boolean;
  created_at: string;
  updated_at?: string;
  panels: ComicPanel[];
  comic_panels?: ComicPanel[]; // Alternative field name for API responses
}

// Type aliases for specific use cases
export type PanelData = ComicPanel; // For confirm page
export type Panel = ComicPanel; // Generic alias

export interface ComicListItem {
  title: string;
  panel_count: number;
  has_cover: boolean;
  cover_image?: string;
}

// API request/response types
export interface ComicArtRequest {
  text_prompt: string;
  reference_image?: string;
  panel_id?: number;
}

export interface ComicArtResponse {
  success: boolean;
  image_data: string;
  message: string;
}

export interface SavePanelRequest {
  comic_title: string;
  panel_id: number;
  image_data: string;
}

export interface SaveComicRequest {
  comic_title: string;
  panels_data: ComicPanel[];
}

export interface VoiceoverRequest {
  voiceover_text: string;
  voice_id?: string;
}

// Auth types
export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

// Component props types
export interface BookSliderProps {
  className?: string;
}

export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

export interface InputProps {
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}
