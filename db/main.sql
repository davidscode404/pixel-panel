-- Users table (handled by Supabase Auth)
-- auth.users already exists

-- Comics table
CREATE TABLE comics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comic panels table
CREATE TABLE comic_panels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    comic_id UUID REFERENCES comics(id) ON DELETE CASCADE,
    panel_number INTEGER NOT NULL,
    storage_path TEXT NOT NULL, -- Path in Supabase Storage
    public_url TEXT, -- Public URL for the image
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_comics_user_id ON comics(user_id);
CREATE INDEX idx_comic_panels_comic_id ON comic_panels(comic_id);