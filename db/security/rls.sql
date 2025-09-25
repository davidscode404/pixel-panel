-- Enable RLS on tables
ALTER TABLE comics ENABLE ROW LEVEL SECURITY;
ALTER TABLE comic_panels ENABLE ROW LEVEL SECURITY;

-- Users can only see their own comics
CREATE POLICY "Users can view own comics" ON comics
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own comics" ON comics
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comics" ON comics
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comics" ON comics
FOR DELETE USING (auth.uid() = user_id);

-- Panels inherit comic permissions
CREATE POLICY "Users can view own comic panels" ON comic_panels
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM comics 
    WHERE comics.id = comic_panels.comic_id 
    AND comics.user_id = auth.uid()
  )
);