/**
 * Type definitions for the PixelPanel application
 */

// User types - compatible with Supabase User
export interface User {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

// Comic types
export interface ComicPanel {
  id: number;
  image_data: string;
  prompt?: string;
}

export interface Comic {
  id?: string;
  title: string;
  panels: ComicPanel[];
  created_at?: string;
  updated_at?: string;
  is_public?: boolean;
  user_id?: string;
}

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
