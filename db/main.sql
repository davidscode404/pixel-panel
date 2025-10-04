-- Users table (handled by Supabase Auth)
-- auth.users already exists

-- User profiles table for credits and user data
CREATE TABLE user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
    credits INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Subscription fields
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    plan_type TEXT DEFAULT 'free',
    status TEXT DEFAULT 'inactive'
);

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
    prompt TEXT, -- Text prompt used to generate the panel
    narration TEXT, -- Generated narration text
    audio_url TEXT, -- URL to generated audio file
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_comics_user_id ON comics(user_id);
CREATE INDEX idx_comic_panels_comic_id ON comic_panels(comic_id);

-- Database functions for credit management
CREATE OR REPLACE FUNCTION get_user_credits(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    user_credits INTEGER;
BEGIN
    SELECT credits INTO user_credits
    FROM public.user_profiles
    WHERE user_id = user_uuid;
    
    RETURN COALESCE(user_credits, 0);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION add_user_credits(user_uuid UUID, credits_to_add INTEGER)
RETURNS INTEGER AS $$
DECLARE
    new_credits INTEGER;
BEGIN
    -- Insert or update user profile with credits
    INSERT INTO public.user_profiles (user_id, credits)
    VALUES (user_uuid, credits_to_add)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        credits = user_profiles.credits + credits_to_add,
        updated_at = NOW()
    RETURNING credits INTO new_credits;
    
    RETURN new_credits;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION deduct_user_credits(user_uuid UUID, credits_to_deduct INTEGER)
RETURNS INTEGER AS $$
DECLARE
    current_credits INTEGER;
    new_credits INTEGER;
BEGIN
    -- Get current credits
    SELECT credits INTO current_credits
    FROM public.user_profiles
    WHERE user_id = user_uuid;
    
    -- Check if user has enough credits
    IF current_credits IS NULL OR current_credits < credits_to_deduct THEN
        RAISE EXCEPTION 'Insufficient credits. Required: %, Available: %', credits_to_deduct, COALESCE(current_credits, 0);
    END IF;
    
    -- Deduct credits
    UPDATE public.user_profiles
    SET 
        credits = credits - credits_to_deduct,
        updated_at = NOW()
    WHERE user_id = user_uuid
    RETURNING credits INTO new_credits;
    
    RETURN new_credits;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION has_sufficient_credits(user_uuid UUID, required_credits INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    current_credits INTEGER;
BEGIN
    SELECT credits INTO current_credits
    FROM public.user_profiles
    WHERE user_id = user_uuid;
    
    RETURN COALESCE(current_credits, 0) >= required_credits;
END;
$$ LANGUAGE plpgsql;