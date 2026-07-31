<?php
// -----------------------------------------------------------------------------
// TEMPLATE di configurazione database.
//
// In PRODUZIONE questo file NON serve caricarlo a mano: il deploy via GitHub
// Actions genera automaticamente "config.php" (stessa cartella) a partire dai
// GitHub Secrets e lo carica accanto a index.php nella cartella /api.
//
// Per un test/deploy MANUALE: copia questo file in "config.php" nella stessa
// cartella e inserisci le credenziali reali. "config.php" e' in .gitignore e
// NON deve mai essere committato.
// -----------------------------------------------------------------------------

return [
    'db_host'    => 'localhost',
    'db_name'    => 'nome_database',
    'db_user'    => 'utente_database',
    'db_pass'    => 'password_database',
    'db_charset' => 'utf8mb4',
];
