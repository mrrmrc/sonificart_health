/**
 * WHO Health Category Classifier
 * 
 * Classifica le caratteristiche visive dell'immagine analizzata nelle 5 categorie
 * terapeutiche del WHO (Health Evidence Network Report 67), assegnando un punteggio
 * 0.0-1.0 a ciascuna categoria basato sulle metriche colorimetriche estratte.
 * 
 * Solo le categorie con score > ACTIVATION_THRESHOLD vengono incluse nel prompt Gemini,
 * evitando di applicare tutte le direttive in modo indiscriminato.
 */

import { BlockAnalysisResult, HealthCategoryScore, HealthClassificationResult, HealthCategoryType } from '../types';

/// --- SOGLIA DI ATTIVAZIONE ---
// Categorie con score inferiore a questa soglia non vengono incluse nel prompt
const ACTIVATION_THRESHOLD = 0.45;

// --- DIRETTIVE WHO PER CATEGORIA (Health Evidence Network Report 67) ---
// Sintesi clinica e neuroscientifica approfondita dei parametri acustici terapeutici
const WHO_DIRECTIVES: Record<HealthCategoryType, { label: string; targetBpm: number; directive: string }> = {
    calming: {
        label: 'Calming / Riduzione Stress e Ansia',
        targetBpm: 64,
        directive: `DIRETTIVA WHO - CALMING, RIDUZIONE STRESS E ANSIA (SISTEMA NERVOSO PARASIMPATICO):
1. TEMPO & RITMO: Tempo lento e stabile tra 56 e 68 BPM (sincronizzazione con la frequenza cardiaca a riposo e respirazione lenta a 6 cicli/min). Ritmo isometrico fluido, privo di sbalzi o sincope accentuata.
2. ARMONIA & SCALA: Modi consonanti (Ionio, Lidio, Pentatonico Maggiore). Prevalenza di intervalli di 5a e 4a giusta, 3a maggiore. ASSENZA TOTALE di dissonanze (2e minori, tritoni, accordi diminuiti) o risoluzioni sospese.
3. TIMBRO & SPETTRO: Inviluppi timbrici ad attacco morbido e lento (>100ms). Filtro passa-basso con attenuazione sotto i 3.5 kHz per disattivare la risposta d'allarme dell'amigdala. Strumentazione consigliata: archi legati con pad caldi, flauto traverso, sintetizzatori analogici morbidi, campane tibetane ad ampia risonanza.
4. DINAMICA & LUFS: Gamma dinamica stretta e pianificata (da pp a mp, max -18 LUFS). Crescendo/diminuendo estremamente graduali. Nessun transitorio impulsivo o picco acustico improvviso.
5. OBIETTIVO CLINICO: Riduzione dei livelli sierici di cortisolo e adrenalina, attivazione del tono vagale (HRV), riduzione dello stato d'ansia acuto e induzione di rilassamento viscerale attivo.`
    },
    physiological: {
        label: 'Regolazione Fisiologica e Modulazione del Dolore',
        targetBpm: 74,
        directive: `DIRETTIVA WHO - REGOLAZIONE FISIOLOGICA E MODULAZIONE DEL DOLORE:
1. ENTRAINMENT RITMICO: Tempo rigido e costante tra 68 e 78 BPM per la regolazione del ritmo baroriflesso, pressione arteriosa e frequenza cardiaca.
2. ESTRATTO SOMATOSENSORIALE (SUB-BASS): Linea di basso pulsante e continua nella regione 60-120 Hz (contrabbasso, cello, sub-synth morbido) per fornire un ancoraggio ritmico propriocettivo e stimolazione vibroacustica corporea.
3. ANALGESIA ACUSTICA (GATE CONTROL THEORY): Tessitura melodica continua, avvolgente e ipnotica con modulazioni micro-timbriche per saturare i canali di elaborazione dell'attenzione nocicettiva senza generare affaticamento cognitivo.
4. INTERVALLI ARMONICI: Prevalenza di intervalli di 6a maggiore e 5a giusta, dimostrati nella ricerca clinica per ridurre la percezione soggettiva dell'intensità del dolore.
5. OBIETTIVO CLINICO: Modulazione della percezione del dolore cronico/acuto, stabilizzazione della pressione sanguigna, regolarizzazione del ritmo respiratorio e cardiaco.`
    },
    cognitive_motor: {
        label: 'Miglioramento Cognitivo e Cueing Motorio',
        targetBpm: 108,
        directive: `DIRETTIVA WHO - MIGLIORAMENTO COGNITIVO E CUEING UDITIVO-MOTORIO (NEUROPLASTICITÀ):
1. AUDITORY MOTOR CUEING (RAS): Tempo marcato e highly strutturato (90-120 BPM per la riabilitazione del passo, sincronizzazione motoria post-ictus o Parkinson).
2. TRANSIENTI & ATTACCO TIMBRICO: Utilizzo prioritario di strumenti ad attacco impulsivo definito (pianoforte, marimba, pizzicato d'archi, percussioni intonate) per fornire marker temporali netti e precisi alla corteccia motoria primaria e ai gangli della base.
3. MELODIA & MEMORIA DI LAVORO: Frasi melodiche chiare a salto o grado congiunto con struttura simmetrica (A-B-A), concepite per stimolare la neuroplasticità dell'ippocampo e il recupero del linguaggio (Melodic Intonation Therapy).
4. COMPLESSITÀ MISURATA: Modulazioni armoniche controllate che mantengano elevata l'attenzione sostenuta senza superare la soglia di saturazione cognitiva del paziente.
5. OBIETTIVO CLINICO: Stimolazione della coordinazione motoria, facilitazione della deambulazione, potenziamento della memoria di lavoro, dell'attenzione e della riabilitazione afasica.`
    },
    social_emotional: {
        label: 'Connessione Sociale ed Espressione Emotiva',
        targetBpm: 86,
        directive: `DIRETTIVA WHO - CONNESSIONE SOCIALE ED ESPRESSIONE EMOTIVA (SISTEMA OSSITOCINERGICO):
1. RISONANZA VOCALE & CORALE: Impiego prioritario di formanti vocali, cori sintetici, voice pad, chitarra acustica e archi caldi per stimolare il sistema dei neuroni specchio e promuovere l'empatia interpersonale.
2. STRUTTURA ARMONICA & CALL-AND-RESPONSE: Progressioni tonali calde e rassicuranti (I - V - vi - IV; I - IV - I - V), frasi musicali concepite a "domanda e risposta" che imitano il dialogo interpersonale.
3. RITMO PARTECIPATIVO: Pulso isometrico accessibile tra 75 e 95 BPM che invita al movimento di gruppo sincronizzato, al battito delle mani o al canto corale.
4. ESPRESSIVITÀ E DINAMICA: Inviluppi dinamici fluidi con crescendo espressivi che rispecchiano le fluttuazioni naturali delle emozioni umane, favorendo il catarsi e il rilascio emotivo.
5. OBIETTIVO CLINICO: Favorire la coesione di gruppo, ridurre il senso di isolamento sociale, stimolare la secrezione di ossitocina ed facilitare l'espressione di vissuti emotivi complessi.`
    },
    motivation: {
        label: 'Motivazione e Adesione al Trattamento',
        targetBpm: 118,
        directive: `DIRETTIVA WHO - MOTIVAZIONE, ENERGIA E ADESIONE TERAPEUTICA (SISTEMA DOPAMINERGICO):
1. GROOVE & PROPULSIONE MOTORIA: Tempo energetico tra 105 e 128 BPM con propulsione ritmica continua (groove sincopato moderato, cassa/percussione costante) adatto a sostenere l'esercizio fisico e la fisioterapia.
2. REWARD ARMONICO & REWARD DOPAMINERGICO: Architettura musicale basata su accumulo di tensione e risoluzioni armoniche altamente gratificanti (build-up e release) per attivare il sistema di ricompensa striatale.
3. SPETTRO BRILLANTE: Presenza di alte frequenze ben bilanciate (synth brillanti, sezioni fiati, arpeggiatori) per innalzare il livello di arousal corticale positivo e combattere l'apatia o la letargia.
4. VARIABILITÀ STRUTTURALE: Alternanza dinamica di sezioni per prevenire l'assuefazione acustica e mantenere costante la motivazione durante l'intero ciclo riabilitativo.
5. OBIETTIVO CLINICO: Aumentare la motivazione all'adesione ai piani di riabilitazione fisica, contrastare la depressione secondaria e incrementare la tolleranza al carico di lavoro fisioterapico.`
    }
};

// --- KEYWORD PER IMAGE DESCRIPTION ---
// Parole chiave nell'imageDescription che influenzano la classificazione
const SOCIAL_KEYWORDS = [
    'persone', 'persona', 'gruppo', 'folla', 'bambini', 'bambino', 'famiglia',
    'people', 'person', 'group', 'crowd', 'children', 'child', 'family',
    'danza', 'dance', 'festa', 'celebration', 'ritratto', 'portrait',
    'volto', 'face', 'mani', 'hands', 'abbraccio', 'embrace',
    'comunità', 'community', 'insieme', 'together', 'crocifissione', 'croce', 'cristo', 'gesù'
];

const NATURE_CALM_KEYWORDS = [
    'mare', 'sea', 'ocean', 'lago', 'lake', 'cielo', 'sky', 'notte', 'night',
    'tramonto', 'sunset', 'alba', 'dawn', 'nebbia', 'fog', 'neve', 'snow',
    'luna', 'moon', 'stelle', 'stars', 'silenzio', 'silence', 'pace', 'peace',
    'meditazione', 'meditation', 'contemplazione', 'contemplation'
];

const ENERGY_KEYWORDS = [
    'fuoco', 'fire', 'fiamma', 'flame', 'esplosione', 'explosion',
    'movimento', 'movement', 'velocità', 'speed', 'sport', 'corsa', 'running',
    'energia', 'energy', 'forza', 'strength', 'potenza', 'power',
    'vento', 'wind', 'tempesta', 'storm', 'onda', 'wave'
];

const COMPLEX_KEYWORDS = [
    'geometrico', 'geometric', 'pattern', 'struttura', 'structure',
    'architettura', 'architecture', 'mosaico', 'mosaic', 'labirinto', 'labyrinth',
    'dettaglio', 'detail', 'complesso', 'complex', 'intricato', 'intricate',
    'simmetria', 'symmetry', 'frattale', 'fractal'
];

/**
 * Calcola la corrispondenza keyword dell'imageDescription con un set di parole chiave.
 * Restituisce un valore 0.0-1.0 basato sul numero di match trovati.
 */
function keywordMatchScore(imageDescription: string, keywords: string[]): number {
    if (!imageDescription) return 0;
    const lower = imageDescription.toLowerCase();
    let matches = 0;
    for (const kw of keywords) {
        if (lower.includes(kw.toLowerCase())) {
            matches++;
        }
    }
    return Math.min(1.0, matches * 0.25);
}

/**
 * Utility: normalizza un valore in un range [0, 1] con clamp.
 */
function normalize(value: number, min: number, max: number): number {
    if (max <= min) return 0.5;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Utility: funzione di prossimità gaussiana - score alto quando value è vicino a center.
 */
function gaussianProximity(value: number, center: number, sigma: number): number {
    const diff = value - center;
    return Math.exp(-(diff * diff) / (2 * sigma * sigma));
}

/**
 * ALGORITMO PRINCIPALE: Classifica le caratteristiche visive nelle 5 categorie WHO.
 */
export function classifyHealthCategories(
    globalStats: BlockAnalysisResult['globalStats'],
    imageDescription: string = ''
): HealthClassificationResult {
    const {
        avg_L,           // Luminosità media (0-100 in Lab)
        avg_a,           // Asse a* Lab: negativo=verde, positivo=rosso
        avg_b,           // Asse b* Lab: negativo=blu/freddo, positivo=giallo/caldo
        avg_saturation,  // Saturazione media HSV (0-1)
        hue_diversity,   // Diversità cromatica normalizzata (0-1)
        avg_variance     // Varianza media della luminanza intra-blocco
    } = globalStats;

    const coldness = normalize(-avg_b, -50, 50);                   // avg_b negativo = freddo
    const lowSaturation = 1 - normalize(avg_saturation, 0, 0.8);  // Bassa saturazione
    const lowVariance = 1 - normalize(avg_variance, 0, 1000);     // Bassa varianza = uniformità
    const lowDiversity = 1 - normalize(hue_diversity, 0, 0.8);    // Bassa diversità cromatica
    const calmKeywords = keywordMatchScore(imageDescription, NATURE_CALM_KEYWORDS);

    const warmth = normalize(avg_a, -30, 50);                      // avg_a positivo = caldo/rosso
    const warmthB = normalize(avg_b, -30, 50);                    // avg_b positivo = giallo/caldo
    const socialKw = keywordMatchScore(imageDescription, SOCIAL_KEYWORDS);
    const energyKw = keywordMatchScore(imageDescription, ENERGY_KEYWORDS);

    // Penalità per la categoria Calming se l'immagine ha elementi caldi/drammatici/sociali
    const calmingPenalties = (warmth * 0.3) + (socialKw * 0.4) + (energyKw * 0.3);

    const calmingScore = Math.max(0, Math.min(1.0,
        (coldness * 0.30 + lowSaturation * 0.30 + lowVariance * 0.20 + lowDiversity * 0.10 + calmKeywords * 0.20) - calmingPenalties
    ));

    const mediumVariance = gaussianProximity(avg_variance, 300, 200);   // Varianza ottimale ~300
    const mediumDiversity = gaussianProximity(hue_diversity, 0.45, 0.2); // Diversità media
    const mediumSaturation = gaussianProximity(avg_saturation, 0.4, 0.2); // Saturazione bilanciata
    const neutralColor = 1 - normalize(Math.abs(avg_a) + Math.abs(avg_b), 0, 80); // Colori neutri

    const physiologicalScore = Math.max(0, Math.min(1.0,
        (mediumVariance * 0.30 + mediumDiversity * 0.20 + mediumSaturation * 0.20 + neutralColor * 0.30) - (socialKw * 0.2)
    ));

    const highDiversity = normalize(hue_diversity, 0.3, 0.9);     // Alta diversità cromatica
    const highVariance = normalize(avg_variance, 200, 1500);       // Alta varianza = dettaglio
    const highSaturation = normalize(avg_saturation, 0.3, 0.9);   // Colori vivaci
    const complexityKw = keywordMatchScore(imageDescription, COMPLEX_KEYWORDS);

    const cognitiveScore = Math.min(1.0,
        highDiversity * 0.30 +
        highVariance * 0.25 +
        highSaturation * 0.20 +
        complexityKw * 0.25
    );

    const goodSaturation = normalize(avg_saturation, 0.2, 0.8);   // Saturazione significativa

    const socialScore = Math.min(1.0,
        warmth * 0.20 +
        warmthB * 0.15 +
        goodSaturation * 0.15 +
        socialKw * 0.50
    );

    const brightness = normalize(avg_L, 30, 80);                   // Luminosità alta
    const strongSaturation = normalize(avg_saturation, 0.3, 0.9); // Saturazione forte
    const strongVariance = normalize(avg_variance, 100, 1000);     // Contrasto forte
    const balancedDiversity = gaussianProximity(hue_diversity, 0.5, 0.3); // Diversità bilanciata

    const motivationScore = Math.min(1.0,
        brightness * 0.20 +
        strongSaturation * 0.20 +
        strongVariance * 0.15 +
        balancedDiversity * 0.15 +
        energyKw * 0.30
    );

    const allScores: HealthCategoryScore[] = [
        {
            category: 'calming',
            score: calmingScore,
            label: WHO_DIRECTIVES.calming.label,
            targetBpm: WHO_DIRECTIVES.calming.targetBpm,
            whoDirective: WHO_DIRECTIVES.calming.directive,
            visualReason: buildVisualReason('calming', { coldness, lowSaturation, lowVariance, lowDiversity, calmKeywords })
        },
        {
            category: 'physiological',
            score: physiologicalScore,
            label: WHO_DIRECTIVES.physiological.label,
            targetBpm: WHO_DIRECTIVES.physiological.targetBpm,
            whoDirective: WHO_DIRECTIVES.physiological.directive,
            visualReason: buildVisualReason('physiological', { mediumVariance, mediumDiversity, mediumSaturation, neutralColor })
        },
        {
            category: 'cognitive_motor',
            score: cognitiveScore,
            label: WHO_DIRECTIVES.cognitive_motor.label,
            targetBpm: WHO_DIRECTIVES.cognitive_motor.targetBpm,
            whoDirective: WHO_DIRECTIVES.cognitive_motor.directive,
            visualReason: buildVisualReason('cognitive_motor', { highDiversity, highVariance, highSaturation, complexityKw })
        },
        {
            category: 'social_emotional',
            score: socialScore,
            label: WHO_DIRECTIVES.social_emotional.label,
            targetBpm: WHO_DIRECTIVES.social_emotional.targetBpm,
            whoDirective: WHO_DIRECTIVES.social_emotional.directive,
            visualReason: buildVisualReason('social_emotional', { warmth, warmthB, goodSaturation, socialKw })
        },
        {
            category: 'motivation',
            score: motivationScore,
            label: WHO_DIRECTIVES.motivation.label,
            targetBpm: WHO_DIRECTIVES.motivation.targetBpm,
            whoDirective: WHO_DIRECTIVES.motivation.directive,
            visualReason: buildVisualReason('motivation', { brightness, strongSaturation, strongVariance, balancedDiversity, energyKw })
        }
    ];

    // Ordina per score decrescente
    allScores.sort((a, b) => b.score - a.score);

    // Seleziona la primaria (score più alto)
    const primaryCategory = allScores[0];

    // Categorie secondarie attive SOLO se superano la soglia 0.45 E hanno uno score vicino a quello primario (almeno 75%)
    const secondaryActive = allScores.slice(1).filter(s => s.score >= ACTIVATION_THRESHOLD && s.score >= primaryCategory.score * 0.75);

    // Massimo 2 categorie attive (1 primaria + al massimo 1 secondaria strettamente correlata)
    const effectiveActive = [primaryCategory, ...secondaryActive].slice(0, 2);

    // Genera il prompt fragment
    const promptFragment = buildPromptFragment(effectiveActive, primaryCategory);

    return {
        primaryCategory,
        activeCategories: effectiveActive,
        allScores,
        promptFragment
    };
}

/**
 * Costruisce una spiegazione leggibile del perché una categoria è stata selezionata.
 */
function buildVisualReason(category: HealthCategoryType, factors: Record<string, number>): string {
    const significant = Object.entries(factors)
        .filter(([_, v]) => v > 0.3)
        .sort(([_, a], [__, b]) => b - a)
        .slice(0, 3);

    if (significant.length === 0) return 'Bassa corrispondenza con le caratteristiche visive.';

    const factorLabels: Record<string, string> = {
        coldness: 'toni freddi (blu/viola)',
        lowSaturation: 'saturazione bassa',
        lowVariance: 'uniformità visiva alta',
        lowDiversity: 'palette cromatica ristretta',
        calmKeywords: 'contenuto visivo rilassante',
        mediumVariance: 'pattern ritmici regolari',
        mediumDiversity: 'diversità cromatica bilanciata',
        mediumSaturation: 'saturazione equilibrata',
        neutralColor: 'colori neutri/bilanciati',
        highDiversity: 'alta diversità cromatica',
        highVariance: 'contorni netti / alto dettaglio',
        highSaturation: 'colori vivaci e saturi',
        complexityKw: 'complessità visiva dal contenuto',
        warmth: 'toni caldi (asse rosso)',
        warmthB: 'toni caldi (asse giallo)',
        goodSaturation: 'buona saturazione dei colori',
        socialKw: 'presenza di figure/persone nell\'immagine',
        brightness: 'alta luminosità',
        strongSaturation: 'saturazione intensa',
        strongVariance: 'forte contrasto visivo',
        balancedDiversity: 'diversità cromatica equilibrata',
        energyKw: 'contenuto visivo energetico'
    };

    const reasons = significant.map(([key, val]) =>
        `${factorLabels[key] || key} (${(val * 100).toFixed(0)}%)`
    );

    return `Attivato da: ${reasons.join(', ')}.`;
}

/**
 * Genera il frammento di prompt da iniettare nella chiamata Gemini.
 * Include solo le direttive WHO rilevanti con i rispettivi pesi.
 */
function buildPromptFragment(
    activeCategories: HealthCategoryScore[],
    primary: HealthCategoryScore
): string {
    const lines: string[] = [];

    lines.push(`CLASSIFICAZIONE TERAPEUTICA VISIVA (WHO Evidence Network Report 67):`);
    lines.push(`L'analisi visiva dell'opera ha identificato le seguenti categorie terapeutiche rilevanti:`);
    lines.push('');

    lines.push(`⭐ CATEGORIA PRIMARIA: "${primary.label}" (Rilevanza: ${(primary.score * 100).toFixed(0)}%)`);
    lines.push(`   Motivo: ${primary.visualReason}`);
    lines.push('');

    if (activeCategories.length > 1) {
        lines.push(`CATEGORIE SECONDARIE ATTIVE:`);
        for (const cat of activeCategories.slice(1)) {
            lines.push(`  • "${cat.label}" (Rilevanza: ${(cat.score * 100).toFixed(0)}%)`);
        }
        lines.push('');
    }

    lines.push(`DIRETTIVE SPECIFICHE DA APPLICARE (NON applicare le altre categorie WHO):`);
    lines.push('');

    for (const cat of activeCategories) {
        lines.push(cat.whoDirective);
        lines.push('');
    }

    lines.push(`REGOLA CRITICA: Applica SOLO le direttive sopra elencate. NON applicare genericamente tutte le raccomandazioni WHO.`);
    lines.push(`La musica deve riflettere la categoria primaria "${primary.label}" come focus terapeutico principale.`);

    return lines.join('\n');
}
