ALTER TABLE history ADD COLUMN music_generation_prompt TEXT DEFAULT NULL;
ALTER TABLE history ADD COLUMN generated_ai_track_url VARCHAR(512) DEFAULT NULL;
