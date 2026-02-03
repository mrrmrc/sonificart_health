# SonificA.R.T. – Quando le Immagini Diventano Musica

*Un ponte tra vista e udito. Arte, ricerca e accessibilità in un unico framework.*

---

## Che cos'è la Sonificazione?

La sonificazione è il processo di traduzione di dati visivi in segnali acustici. Esistono già sistemi che generano musica "ispirata" alle immagini, ma SonificA.R.T. compie un passo fondamentale: **è deterministico**.

Cosa significa? Che se carichi la stessa immagine due volte, otterrai **sempre lo stesso risultato sonoro**. Non c'è casualità, non c'è interpretazione variabile. Ogni pixel, ogni variazione di colore e ogni contrasto di luce corrispondono a precise scelte sonore, matematicamente definite.

> **Importante chiarire:** SonificA.R.T. non certifica opere d'arte fisiche e non è un sistema anti-contraffazione per dipinti. Quello che fa è creare una **relazione univoca tra un file digitale e il suo suono**. Questa relazione è verificabile e ripetibile nel tempo.

---

## A Cosa Serve Davvero?

SonificA.R.T. ha tre ambiti di applicazione concreti:

### 🏅 1. Integrità dei File Digitali

Se hai un'immagine digitale e vuoi verificare che non sia stata alterata, puoi sonificarla e confrontare il risultato con una sonificazione precedente. Se il suono è identico, il file è integro. È una sorta di "impronta sonora" del file.

**Esempio pratico:** Un fotografo consegna un file a un cliente. Anni dopo, il cliente vuole verificare che sia lo stesso file originale. Basta sonificare entrambi: se il suono coincide, il file non è stato modificato.

### 🔬 2. Ricerca Scientifica

Per ricercatori interessati a sinestesia, percezione cross-modale o Digital Humanities, SonificA.R.T. offre un **framework ripetibile**. Ogni esperimento può essere replicato con risultati identici, rendendo la sonificazione un metodo scientifico valido.

Utilizza lo standard colorimetrico **CIE LAB** per analizzare i pixel, garantendo precisione e coerenza tra sessioni diverse.

### 🎨 3. Arte e Creatività

Per artisti digitali, musicisti e performer, SonificA.R.T. apre nuovi linguaggi espressivi. La **Modalità Live Performance** permette di usare la webcam per controllare il suono in tempo reale:

- **Tracciamento oculare:** Lo sguardo modula filtri e panneggio stereo
- **Movimento della testa:** Cambia ottava, delay e chorus
- **Espressioni facciali:** Il sorriso attiva il modo maggiore, le sopracciglia modulano la tensione armonica

Il tutto processato **localmente nel browser** — nessun video viene inviato a server esterni.

---

## 🌍 48 Tradizioni Musicali Globali

A differenza di altri sistemi che usano solo scale occidentali, SonificA.R.T. integra un database di **48 tradizioni musicali mondiali**.

Un mosaico andaluso può suonare con scale Maqam arabe. Un ukiyo-e giapponese con la scala pentatonica tradizionale. Un affresco bizantino con canti gregoriani.

Il sistema rispetta l'origine culturale dell'opera, usando scale microtonali, timbri e strutture ritmiche autentiche di ogni tradizione.

---

## �️ Accessibilità Museale

Una delle applicazioni più significative riguarda l'**accessibilità**. 

Immaginate un visitatore ipovedente che, per la prima volta, può "percepire" la composizione di un quadro attraverso l'udito: i contrasti chiaroscurali diventano variazioni di volume, i colori caldi diventano timbri morbidi, le zone scure diventano bassi profondi.

Non è una descrizione vocale dell'opera — è una **traduzione sensoriale diretta**. La luce diventa volume, il colore diventa timbro, la composizione diventa ritmo.

---

## Il Contenitore SAC (Sonified Art Container)

Invece di un semplice file audio, SonificA.R.T. genera un archivio **.SAC** che contiene:

```
├── original_image.jpg      (Immagine sorgente)
├── generated_audio.wav     (Audio master PCM)
├── musical_notation.mid    (Partitura MIDI)
├── sonification_data.json  (Parametri completi)
├── scan_visualization.mp4  (Video della scansione)
└── integrity_manifest.json (Hash SHA-256)
```

L'**hash SHA-256** funge da "impronta digitale" del processo: permette di verificare che immagine e audio siano stati generati insieme e non siano stati alterati successivamente.

---

## Come Funziona Tecnicamente?

Il cuore di SonificA.R.T. analizza la struttura dell'immagine:

| Elemento Visivo | Traduzione Sonora |
|-----------------|-------------------|
| **Luminosità** | Volume e dinamica |
| **Tonalità (Hue)** | Altezza della nota (pitch) |
| **Saturazione** | Timbro e intensità |
| **Posizione** | Progressione temporale della melodia |

La scansione dell'immagine (come un occhio che la percorre) crea una sequenza temporale. Il risultato è un video dove uno scanner attraversa l'opera in tempo reale, permettendo di vedere **quale pixel sta generando quale suono**.

---

## Stack Tecnologico

- **Frontend:** React.js + TypeScript + Vite
- **Design:** TailwindCSS con estetica glassmorphism
- **Audio:** Web Audio API per sintesi in tempo reale
- **Video:** Canvas API per generazione video con telemetria
- **AI:** Google Gemini per analisi contestuale e suggerimenti culturali

---

## In Sintesi

SonificA.R.T. non è un generatore di musica casuale. È un **framework scientifico** che crea una relazione matematica tra immagini e suono.

**È utile per:**
- ✅ Verificare l'integrità di file digitali
- ✅ Condurre ricerche ripetibili sulla percezione
- ✅ Creare nuove forme di arte interattiva
- ✅ Rendere l'arte accessibile a chi non può vederla

**Non è:**
- ❌ Un sistema di autenticazione per opere d'arte fisiche
- ❌ Un anti-contraffazione per dipinti
- ❌ Un generatore di musica casuale

---

## Prova Subito

Visita [sonificart.com](https://sonificart.com), scegli un'opera dalla galleria, e scopri come suona.

Poi attiva la Live Performance: guarda, sorridi, muovi la testa — e ascolta l'arte rispondere a te.

---

*SonificA.R.T. — L'arte che suona. Il suono che si vede.*
