---
description: Modalità Produzione Sicura - Regole per modifiche controllate
---

# 🛡️ Modalità Produzione Sicura

Questo workflow garantisce che le modifiche al codice siano **mirate, controllate e sicure** per un ambiente di produzione.

---

## 📋 REGOLE OBBLIGATORIE

### 1. Analisi della Richiesta
Prima di qualsiasi modifica, devo:
- Capire esattamente cosa l'utente vuole modificare
- Identificare i file coinvolti
- Verificare che non ci siano effetti collaterali su altre aree

### 2. Dichiarazione di Scope
Prima di modificare qualsiasi file, devo presentare all'utente:

```
📋 SCOPE MODIFICA:
✅ File da modificare: [lista file]
❌ File che NON toccherò: [lista aree escluse]
🎯 Obiettivo: [descrizione precisa]
⚠️ Rischi potenziali: [eventuali rischi]
```

### 3. Attendere Approvazione
**NON** eseguire modifiche finché l'utente non conferma con:
- "OK"
- "Procedi"
- "Vai"
- O simile conferma esplicita

### 4. Aree Critiche - MAI Toccare Senza Esplicita Richiesta

| Area | File | Descrizione |
|------|------|-------------|
| **Motore Sonificazione** | `sonificationService.ts`, `AudioSynthesis.ts` | Core della sonificazione |
| **Backend API** | `backend/index.php` | Logica server |
| **Database** | `*.sql`, schema | Struttura dati |
| **Autenticazione** | `AuthContext.tsx`, login | Sicurezza utenti |
| **Configurazione** | `vite.config.ts`, `package.json` | Build e dipendenze |

### 5. Aree Safe - Modificabili con Conferma

| Area | File | Descrizione |
|------|------|-------------|
| **Homepage** | `LandingPage.tsx`, `LandingPageWrapper.tsx` | Pagina principale |
| **Stili** | `index.css`, componenti UI | Solo CSS/styling |
| **Testi** | `translations.ts` | Traduzioni |
| **Documentazione** | `docs/*.md` | Guide e articoli |

---

## ✅ WORKFLOW DI MODIFICA

### Step 1: Ricevo la richiesta
L'utente chiede una modifica.

### Step 2: Analizzo e dichiaro scope
Presento la lista di file che intendo modificare e quelli che NON toccherò.

### Step 3: Attendo conferma
**STOP** - Aspetto che l'utente dica "OK" o simile.

### Step 4: Eseguo la modifica
Solo dopo conferma, procedo con le modifiche.

### Step 5: Build di verifica
// turbo
Eseguo `npm run build` per verificare che non ci siano errori.

### Step 6: Riepilogo
Mostro cosa è stato modificato e confermo il successo.

---

## 🚨 REGOLA D'ORO

> **Se non sei sicuro che una modifica sia nel scope richiesto, CHIEDI prima di fare.**

Mai assumere che una modifica correlata sia desiderata. Se l'utente chiede di cambiare il colore di un pulsante, NON toccare la logica JavaScript dietro quel pulsante.

---

## 📝 Esempio di Interazione Corretta

**Utente:** "Cambia il titolo della homepage"

**Assistente:**
```
📋 SCOPE MODIFICA:
✅ File da modificare: src/components/LandingPage.tsx (solo testo titolo)
❌ File che NON toccherò: 
   - sonificationService.ts
   - ResultsDashboard.tsx
   - Backend PHP
   - Qualsiasi logica funzionale
🎯 Obiettivo: Modificare solo il testo del titolo nella hero section
⚠️ Rischi potenziali: Nessuno (modifica solo testuale)

Confermi che posso procedere?
```

**Utente:** "OK"

**Assistente:** [procede con la modifica]
