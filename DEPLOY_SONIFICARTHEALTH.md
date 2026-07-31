# Deploy automatico su sonificarthealth.sviluppo.host (FTP)

Il deploy avviene tramite **GitHub Actions** (`.github/workflows/deploy.yml`):
a ogni push su `main` (o lanciandolo a mano da **Actions → Run workflow**) il
workflow builda il frontend e carica via **FTP** sull'host:

- il frontend buildato (`internet/`) → **web root** del sito;
- il backend PHP (`backend/index.php`) → cartella **`/api`** del sito;
- un file **`api/config.php`** con le credenziali del database, generato al
  volo dai Secrets (non è mai nel repository).

Lo schema del database viene creato **da solo** al primo caricamento della
pagina (le tabelle `users`, `history`, `showcase`, ecc. sono create con
`CREATE TABLE IF NOT EXISTS`). In alternativa puoi importare `backend/schema.sql`
da phpMyAdmin.

---

## Passo unico da fare a mano: i Secrets

Vai su **GitHub → repo `sonificart_health` → Settings → Secrets and variables →
Actions → New repository secret** e crea questi 7 secret:

| Secret     | Cosa contiene                                    |
|------------|--------------------------------------------------|
| `FTP_HOST` | l'host FTP dell'hosting                           |
| `FTP_USER` | l'utente FTP                                      |
| `FTP_PASS` | la password FTP                                   |
| `DB_HOST`  | l'host del database (di solito `localhost`)       |
| `DB_NAME`  | il nome del database                              |
| `DB_USER`  | l'utente del database                             |
| `DB_PASS`  | la password del database                          |

> I valori concreti sono quelli forniti dall'hosting. Non vanno scritti nel
> codice: restano solo qui nei Secrets.

Dopo aver aggiunto i Secrets: **Actions → "Deploy sonificart-health (FTP)" →
Run workflow** (oppure fai un qualsiasi push su `main`). Finché i Secrets non
esistono, il workflow builda ma **non carica nulla** (nessun errore).

---

## Note importanti

- **Cartella di destinazione FTP.** Il workflow carica nella radice FTP (`./`).
  Se sul tuo hosting il sito sta in una sottocartella (`public_html/`,
  `htdocs/`, `www/`…), modifica `server-dir` in `.github/workflows/deploy.yml`.
- **FTP in chiaro.** Il workflow usa FTP semplice sulla porta 21. Se l'hosting
  supporta FTPS, cambia `protocol: ftp` in `protocol: ftps` per cifrare la
  connessione.
- **Cartella `media/`.** Gli upload degli utenti finiscono in `media/` sul
  server: il deploy **non** la tocca.
- **Sicurezza credenziali.** Le password non sono nel repository. Se sono state
  condivise in chiaro da qualche parte, è buona norma cambiarle dall'hosting.
