-- Enable RLS on tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE comics ENABLE ROW LEVEL SECURITY;
ALTER TABLE comic_panels ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (
        auth.uid() = user_id OR 
        auth.role() = 'service_role'
    );

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        auth.role() = 'service_role'
    );

CREATE POLICY "Service role can insert profiles" ON user_profiles
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Comics policies
CREATE POLICY "Users can view own comics" ON comics
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view public comics" ON comics
FOR SELECT USING (is_public = true);

CREATE POLICY "Users can insert own comics" ON comics
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comics" ON comics
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comics" ON comics
FOR DELETE USING (auth.uid() = user_id);

-- Comic panels policies
CREATE POLICY "Users can view own comic panels" ON comic_panels
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM comics 
    WHERE comics.id = comic_panels.comic_id 
    AND comics.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view public comic panels" ON comic_panels
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM comics 
    WHERE comics.id = comic_panels.comic_id 
    AND comics.is_public = true
  )
);

CREATE POLICY "Users can insert own comic panels" ON comic_panels
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM comics 
    WHERE comics.id = comic_panels.comic_id 
    AND comics.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own comic panels" ON comic_panels
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM comics 
    WHERE comics.id = comic_panels.comic_id 
    AND comics.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own comic panels" ON comic_panels
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM comics 
    WHERE comics.id = comic_panels.comic_id 
    AND comics.user_id = auth.uid()
  )
);