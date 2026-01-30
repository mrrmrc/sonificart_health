-- ============================================
-- MIGRAZIONE DATI: Preservare audio esistenti
-- ============================================
-- Esegui queste query IN ORDINE per creare la colonna e migrare i dati

-- STEP 1: Crea la colonna (se non esiste)
ALTER TABLE history ADD COLUMN original_audio_url VARCHAR(500) DEFAULT NULL;

-- STEP 2: Migra i dati esistenti (copia audio_url in original_audio_url)
UPDATE history 
SET original_audio_url = audio_url 
WHERE original_audio_url IS NULL 
  AND audio_url IS NOT NULL 
  AND audio_url != '';

-- STEP 3: Verifica la migrazione
SELECT 
    COUNT(*) as total_entries,
    SUM(CASE WHEN audio_url IS NOT NULL AND audio_url != '' THEN 1 ELSE 0 END) as entries_with_audio,
    SUM(CASE WHEN original_audio_url IS NOT NULL AND original_audio_url != '' THEN 1 ELSE 0 END) as entries_with_original_audio
FROM history;

-- Se entries_with_audio = entries_with_original_audio, la migrazione è completa!
