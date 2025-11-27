# GUIDA AL DEPLOYMENT: SonificA.R.T. v1.0

Questa guida ti accompagna passo dopo passo nella pubblicazione di SonificA.R.T. su un hosting standard (es. Aruba, SiteGround, Netsons) con supporto **PHP** e **MySQL**.

---

## 1. PREREQUISITI

Assicurati di avere:
1.  **Sul tuo computer:**
    *   [Node.js](https://nodejs.org/) installato.
    *   Un editor di codice (es. Visual Studio Code).
    *   Un client FTP (es. FileZilla).
2.  **Sul tuo Hosting:**
    *   Accesso FTP.
    *   Accesso al pannello di controllo (cPanel/Plesk).
    *   Accesso a **phpMyAdmin** (o gestione Database).

---

## 2. PREPARAZIONE LOCALE (Sul tuo PC)

### Passo A: Installazione
Apri il terminale nella cartella del progetto ed esegui:
```bash
npm install
```

### Passo B: Configurazione per Produzione
Prima di costruire il sito, devi dire a React di collegarsi al server vero e non usare i dati finti.

1.  Apri il file: `src/services/api.ts`
2.  Cerca la riga: `export const USE_MOCK_BACKEND = true;`
3.  **Cambiala in:**
    ```typescript
    export const USE_MOCK_BACKEND = false;
    ```
4.  Salva il file.

### Passo C: Build (Costruzione)
Esegui il comando per generare i file ottimizzati per il web:
```bash
npm run build
```
Questo creerà una cartella chiamata **`dist`** nel tuo progetto.
*Contiene: index.html, file .js, file .css e le immagini.*

---

## 3. CONFIGURAZIONE DATABASE (Sul Server)

1.  Accedi al pannello del tuo hosting.
2.  Vai su **Gestione Database** (o MySQL Databases).
3.  Crea un nuovo database (es. `my_sonificart`).
4.  Crea un utente per il database e annota la **password**.
5.  Apri **phpMyAdmin**.
6.  Seleziona il database appena creato.
7.  Clicca su **"Importa"** in alto.
8.  Carica il file `backend/schema.sql` che trovi nella cartella del progetto.
9.  Clicca "Esegui".
    *   *Risultato:* Dovresti vedere create le tabelle `users`, `history`, `showcase`.

---

## 4. CONFIGURAZIONE BACKEND (PHP)

1.  Apri il file `backend/index.php` con un editor di testo.
2.  Modifica le prime righe con i dati del tuo database reale:

```php
$host = 'localhost';        // Quasi sempre è localhost (o l'IP fornito dall'host)
$db   = 'nome_del_tuo_db';  // Es. my_sonificart
$user = 'nome_utente_db';   // Es. admin_sonificart
$pass = 'la_tua_password';  // La password impostata al punto 3
```
3.  Salva il file.

---

## 5. UPLOAD SUL SERVER (FTP)

1.  Apri FileZilla e collegati al tuo sito.
2.  Vai nella cartella pubblica (solitamente `public_html`, `www` o `htdocs`).

### Caricamento Frontend
3.  Apri la cartella **`dist`** sul tuo computer.
4.  Trascina **tutto il contenuto** (index.html, cartella assets, ecc.) dentro la `public_html` del server.

### Caricamento Backend
5.  Nella `public_html` del server, crea una nuova cartella chiamata **`api`**.
6.  Entra nella cartella `api`.
7.  Carica dentro il file `backend/index.php` (quello che hai modificato con le password).

---

## 6. VERIFICA FINALE

1.  Vai su `www.tuosito.com`.
2.  Dovresti vedere la Landing Page di SonificA.R.T.
3.  Prova a **Registrarti**:
    *   Se funziona, riceverai i crediti e verrai loggato.
    *   Se ricevi un errore, controlla di aver messo le password del database giuste in `api/index.php`.
4.  Vai nella sezione **Admin** (dovrai modificare manualmente un utente nel database cambiandogli `is_admin` a `1` tramite phpMyAdmin per il primo accesso admin, oppure registrarti e modificare il record).

### Risoluzione Problemi Comuni

*   **Errore 404 su /api/index.php:** Hai caricato il file nella cartella sbagliata. Deve essere in `tuosito.com/api/index.php`.
*   **Schermo Bianco:** Controlla la Console del browser (F12).
*   **Errore Database:** Verifica user/password nel file PHP.

---
*Buona Fortuna!*
