# 🔒 Migrazione: Separazione Audio Originale / Audio Elaborato

## Problema
Quando un utente carica un nuovo audio (es. da Suno/Udio) nel pannello "Pubblicazione", 
questo **sovrascrive** l'audio originale della sonificazione, perdendolo per sempre.

## Soluzione
Creare due campi separati nel database:
- `original_audio_url` → Audio IMMUTABILE della sonificazione (SAC)
- `audio_url` → Audio MODIFICABILE per pubblicazione (Suno, Udio, ecc.)

---

## 1️⃣ QUERY SQL - Aggiungere la colonna

```sql
-- Esegui questa query nel database MySQL
ALTER TABLE history 
ADD COLUMN original_audio_url VARCHAR(500) DEFAULT NULL 
AFTER audio_url;

-- Migrare i dati esistenti (copia audio_url in original_audio_url per tutte le entry esistenti)
UPDATE history 
SET original_audio_url = audio_url 
WHERE original_audio_url IS NULL AND audio_url IS NOT NULL;
```

---

## 2️⃣ MODIFICA index.php - Schema Migration Automatica

Aggiungi questa riga nella sezione "Ensure Database Schema is up to date" (dopo la riga ~99):

```php
// Aggiungere dopo la riga: $pdo->exec("ALTER TABLE history ADD COLUMN IF NOT EXISTS validation_hashes TEXT DEFAULT NULL");

// NEW: Separate original audio (immutable) from custom audio (modifiable)
$pdo->exec("ALTER TABLE history ADD COLUMN IF NOT EXISTS original_audio_url VARCHAR(500) DEFAULT NULL");
```

---

## 3️⃣ MODIFICA save_sonification - Salvare in original_audio_url

Trova la sezione `save_sonification` (circa riga 405) e modifica l'INSERT per includere `original_audio_url`:

**PRIMA (riga ~453):**
```php
$stmt = $pdo->prepare("INSERT INTO history (user_id, image_hash, paradigm, tradition_name, image_url, audio_url, music_generation_prompt, generated_ai_track_url, config_json, event_data, block_data, title, description, audio_hash, acquisition_metadata, validation_hashes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
$stmt->execute([$userId, $hash, $input['paradigm'] ?? 'scientific', $input['traditionName'] ?? 'Standard', $imgUrl, $audioUrl, $musicPrompt, $generatedAiTrackUrl, $configJson, $eventData, $blockData, $finalTitle, $description, $audioHash, $acquisitionMetadata, $validationHashes]);
```

**DOPO:**
```php
// Check if this is the original sonification audio (saveToOriginalAudio flag from frontend)
$isOriginalAudio = $_POST['saveToOriginalAudio'] ?? $input['saveToOriginalAudio'] ?? false;

$stmt = $pdo->prepare("INSERT INTO history (user_id, image_hash, paradigm, tradition_name, image_url, audio_url, original_audio_url, music_generation_prompt, generated_ai_track_url, config_json, event_data, block_data, title, description, audio_hash, acquisition_metadata, validation_hashes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

// If original audio, save in BOTH fields (audio_url for compatibility, original_audio_url for immutability)
$originalAudioUrl = $isOriginalAudio ? $audioUrl : null;

$stmt->execute([$userId, $hash, $input['paradigm'] ?? 'scientific', $input['traditionName'] ?? 'Standard', $imgUrl, $audioUrl, $originalAudioUrl, $musicPrompt, $generatedAiTrackUrl, $configJson, $eventData, $blockData, $finalTitle, $description, $audioHash, $acquisitionMetadata, $validationHashes]);
```

---

## 4️⃣ MODIFICA attach_audio_to_history - NON sovrascrivere original_audio_url

Trova la sezione `attach_audio_to_history` (circa riga 828).

**PRIMA (riga ~886):**
```php
$pdo->prepare("UPDATE history SET audio_url = ?, tradition_name = ? WHERE id = ?")->execute([$finalAudioUrl, $fileName, $entryId]);
```

**DOPO:**
```php
// Check if saveToCustomAudio flag is set (meaning this is an elaborated version, NOT the original)
$isCustomAudio = $_POST['saveToCustomAudio'] ?? $input['saveToCustomAudio'] ?? false;

if ($isCustomAudio) {
    // Save ONLY to audio_url (custom/elaborated) - DO NOT touch original_audio_url
    $pdo->prepare("UPDATE history SET audio_url = ?, tradition_name = ? WHERE id = ?")->execute([$finalAudioUrl, $fileName, $entryId]);
} else {
    // Legacy behavior: save to both (for backward compatibility with old frontend)
    // First check if original_audio_url is empty, if so, preserve it
    $stmt = $pdo->prepare("SELECT original_audio_url FROM history WHERE id = ?");
    $stmt->execute([$entryId]);
    $existingOriginal = $stmt->fetchColumn();
    
    if (empty($existingOriginal)) {
        // No original exists, this is the first audio upload, save to both
        $pdo->prepare("UPDATE history SET audio_url = ?, original_audio_url = ?, tradition_name = ? WHERE id = ?")->execute([$finalAudioUrl, $finalAudioUrl, $fileName, $entryId]);
    } else {
        // Original exists, only update audio_url (custom)
        $pdo->prepare("UPDATE history SET audio_url = ?, tradition_name = ? WHERE id = ?")->execute([$finalAudioUrl, $fileName, $entryId]);
    }
}
```

---

## 5️⃣ MODIFICA get_history - Restituire entrambi i campi

Trova la sezione `get_history` (circa riga 492) e aggiungi `original_audio_url` al SELECT e al mapping.

**PRIMA (riga ~502-505):**
```php
$stmt = $pdo->prepare("
    SELECT 
        id, image_hash, timestamp, image_url, audio_url, paradigm, tradition_name, 
        title, subtitle, description, video_url, generated_ai_track_url, event_data, music_generation_prompt
    FROM history 
    ...
");
```

**DOPO:**
```php
$stmt = $pdo->prepare("
    SELECT 
        id, image_hash, timestamp, image_url, audio_url, original_audio_url, paradigm, tradition_name, 
        title, subtitle, description, video_url, generated_ai_track_url, event_data, music_generation_prompt
    FROM history 
    ...
");
```

**E nel mapping (riga ~528-543), aggiungi:**
```php
return [
    "id" => (string) $h['id'],
    "imageHash" => $h['image_hash'],
    // ... existing fields ...
    "audioUrl" => $h['audio_url'] ? ((strpos($h['audio_url'], '/media') !== false) ? $baseUrl . $h['audio_url'] : $h['audio_url']) : null,
    // NEW: Original audio URL (immutable)
    "originalAudioUrl" => ($h['original_audio_url'] ?? null) ? ((strpos($h['original_audio_url'], '/media') !== false) ? $baseUrl . $h['original_audio_url'] : $h['original_audio_url']) : null,
    // ... rest of fields ...
];
```

---

## 6️⃣ MODIFICA get_history_item - Restituire entrambi i campi

Trova la sezione `get_history_item` (circa riga 551) e aggiungi nel response:

```php
sendResponse([
    "id" => (string) $h['id'],
    // ... existing fields ...
    "audioUrl" => $h['audio_url'] ? ((strpos($h['audio_url'], '/media') !== false) ? $baseUrl . $h['audio_url'] : $h['audio_url']) : null,
    // NEW: Original audio URL
    "originalAudioUrl" => ($h['original_audio_url'] ?? null) ? ((strpos($h['original_audio_url'], '/media') !== false) ? $baseUrl . $h['original_audio_url'] : $h['original_audio_url']) : null,
    // ... rest of fields ...
]);
```

---

## ✅ Verifica Finale

Dopo aver applicato tutte le modifiche:

1. Esegui la query SQL per aggiungere la colonna e migrare i dati esistenti
2. Testa creando una nuova sonificazione → l'audio deve essere salvato in `original_audio_url`
3. Vai su Pubblicazione e carica un nuovo audio → deve andare SOLO in `audio_url`
4. Torna su Sonificazione → l'audio riprodotto deve essere quello originale (`original_audio_url`)

---

## Note Importanti

- **Backward Compatibility**: Il frontend è già pronto per gestire entrambi i campi
- **Migrazione Dati**: La query `UPDATE history SET original_audio_url = audio_url` preserva gli audio esistenti
- **Showcase**: Se necessario, aggiungere anche `original_audio_url` alla tabella `showcase`
