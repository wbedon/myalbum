-- Allow anon to read usernames/bios for public profile pages
CREATE POLICY "public_profiles_anon_select" ON profiles
  FOR SELECT USING (true);
