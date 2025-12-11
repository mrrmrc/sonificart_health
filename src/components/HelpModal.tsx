import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialSection?: string;
}

type HelpTab = 'guide' | 'interface' | 'faq' | 'scientific';

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, initialSection }) => {
    const [activeTab, setActiveTab] = useState<HelpTab>('guide');
    const { t } = useLanguage();

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Auto-scroll logic
    useEffect(() => {
        if (isOpen && initialSection) {
            if (['doc-colorimetry', 'doc-database', 'doc-determinism', 'doc-pipeline', 'doc-sac'].includes(initialSection)) {
                setActiveTab('scientific');
                setTimeout(() => {
                    const el = document.getElementById(initialSection);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        // Open detail if it's a summary
                        const details = el.closest('details');
                        if (details) details.open = true;
                    }
                }, 100);
            }
        }
    }, [isOpen, initialSection]);

    if (!isOpen) return null;

    const renderContent = () => {
        switch (activeTab) {
            case 'guide':
                return (
                    <div className="space-y-8 animate-fade-in">
                        <div className="bg-brand-secondary/50 p-6 rounded-xl border border-brand-accent/20">
                            <h3 className="text-2xl font-display font-bold text-white mb-4">{t('help.guide.title')}</h3>
                            <p className="text-brand-text-secondary leading-relaxed mb-6">
                                {t('help.guide.intro')}
                            </p>

                            <div className="space-y-6">
                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-accent text-black font-bold flex items-center justify-center">1</div>
                                    <div>
                                        <h4 className="text-lg font-bold text-white mb-1">{t('help.guide.step1')}</h4>
                                        <p className="text-sm text-brand-text-secondary">
                                            {t('help.guide.step1_desc')}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white text-black font-bold flex items-center justify-center">2</div>
                                    <div>
                                        <h4 className="text-lg font-bold text-white mb-1">{t('help.guide.step2')}</h4>
                                        <p className="text-sm text-brand-text-secondary">
                                            {t('help.guide.step2_desc')}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white text-black font-bold flex items-center justify-center">3</div>
                                    <div>
                                        <h4 className="text-lg font-bold text-white mb-1">{t('help.guide.step3')}</h4>
                                        <p className="text-sm text-brand-text-secondary">
                                            {t('help.guide.step3_desc')}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white text-black font-bold flex items-center justify-center">4</div>
                                    <div>
                                        <h4 className="text-lg font-bold text-white mb-1">{t('help.guide.step4')}</h4>
                                        <p className="text-sm text-brand-text-secondary">
                                            {t('help.guide.step4_desc')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'interface':
                return (
                    <div className="space-y-8 animate-fade-in">
                        <h3 className="text-xl font-bold text-white border-b border-white/10 pb-4">{t('help.tabs.glossary')}</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white/5 p-4 rounded-lg">
                                <h4 className="font-bold text-brand-accent mb-2"><i className="fas fa-video mr-2"></i> {t('help.glossary.kinetic')}</h4>
                                <p className="text-xs text-brand-text-secondary">
                                    {t('help.glossary.kinetic_desc')}
                                </p>
                            </div>

                            <div className="bg-white/5 p-4 rounded-lg">
                                <h4 className="font-bold text-brand-accent mb-2"><i className="fas fa-box mr-2"></i> {t('help.glossary.sac')}</h4>
                                <p className="text-xs text-brand-text-secondary">
                                    {t('help.glossary.sac_desc')}
                                </p>
                            </div>

                            <div className="bg-white/5 p-4 rounded-lg">
                                <h4 className="font-bold text-brand-accent mb-2"><i className="fas fa-coins mr-2"></i> {t('help.glossary.credits')}</h4>
                                <p className="text-xs text-brand-text-secondary">
                                    {t('help.glossary.credits_desc')}
                                </p>
                            </div>

                            <div className="bg-white/5 p-4 rounded-lg">
                                <h4 className="font-bold text-brand-accent mb-2"><i className="fas fa-fingerprint mr-2"></i> {t('help.glossary.hash')}</h4>
                                <p className="text-xs text-brand-text-secondary">
                                    {t('help.glossary.hash_desc')}
                                </p>
                            </div>
                        </div>
                    </div>
                );

            case 'faq':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <h3 className="text-xl font-bold text-white border-b border-white/10 pb-4">{t('help.tabs.faq')}</h3>

                        <div className="space-y-4">
                            {/* DOMANDA 1 */}
                            <details className="bg-black/30 rounded-lg p-4 open:bg-black/50 transition-colors">
                                <summary className="font-bold text-white cursor-pointer flex justify-between items-center">
                                    {t('help.faq.q1')}
                                    <i className="fas fa-chevron-down text-xs"></i>
                                </summary>
                                <p
                                    className="mt-2 text-sm text-brand-text-secondary"
                                    dangerouslySetInnerHTML={{ __html: t('help.faq.a1') }}
                                />
                            </details>

                            {/* DOMANDA 2 */}
                            <details className="bg-black/30 rounded-lg p-4 open:bg-black/50 transition-colors">
                                <summary className="font-bold text-white cursor-pointer flex justify-between items-center">
                                    {t('help.faq.q2')}
                                    <i className="fas fa-chevron-down text-xs"></i>
                                </summary>
                                <p
                                    className="mt-2 text-sm text-brand-text-secondary"
                                    dangerouslySetInnerHTML={{ __html: t('help.faq.a2') }}
                                />
                            </details>

                            {/* DOMANDA 3 */}
                            <details className="bg-black/30 rounded-lg p-4 open:bg-black/50 transition-colors">
                                <summary className="font-bold text-white cursor-pointer flex justify-between items-center">
                                    {t('help.faq.q3')}
                                    <i className="fas fa-chevron-down text-xs"></i>
                                </summary>
                                <p
                                    className="mt-2 text-sm text-brand-text-secondary"
                                    dangerouslySetInnerHTML={{ __html: t('help.faq.a3') }}
                                />
                            </details>
                        </div>
                    </div>
                );

            case 'scientific':
                return (
                    <div className="space-y-6 animate-fade-in pb-10">
                        {/* 
                            NOTA: Questa sezione scientifica è ancora hardcoded in Italiano 
                            come da codice originale, poiché il file di traduzione 
                            aggiornato copriva solo la sezione FAQ. 
                        */}
                        <div className="bg-brand-secondary/50 p-4 rounded-lg border border-brand-secondary mb-6">
                            <h2 className="text-xl font-bold text-white mb-2">White Paper Tecnico</h2>
                            <p className="text-sm text-brand-text-secondary">
                                Documentazione completa del Framework SonificA.R.T. v1.0.
                                <br />Basato su: <em>"Metodologia Deterministica per Sonificazione Culturalmente Consapevole dell'Arte Visiva"</em> (Mirra, 2025).
                            </p>
                        </div>

                        {/* 1. INTRODUZIONE E MOTIVAZIONI */}
                        <details className="group bg-black/20 rounded-lg border border-white/10 overflow-hidden">
                            <summary className="flex justify-between items-center p-4 cursor-pointer bg-white/5 hover:bg-white/10 transition-colors">
                                <h3 className="font-bold text-white">1. Introduzione e Motivazioni</h3>
                                <i className="fas fa-chevron-down text-brand-text-secondary group-open:rotate-180 transition-transform"></i>
                            </summary>
                            <div className="p-6 text-sm text-brand-text-secondary space-y-4 leading-relaxed border-t border-white/5">
                                <p>
                                    La sonificazione di contenuti visivi è un dominio interdisciplinare che interseca musica computerizzata e studi culturali. SonificA.R.T. v1.0 affronta tre limitazioni fondamentali dei sistemi esistenti:
                                </p>
                                <ul className="list-disc pl-5 space-y-2">
                                    <li>
                                        <strong className="text-white">Bias Culturale Occidentale:</strong> La maggioranza dei sistemi usa solo il temperamento equabile a 12 toni (12-TET), ignorando la diversità dei sistemi scalari mondiali e perpetuando un colonialismo tecnologico.
                                    </li>
                                    <li>
                                        <strong className="text-white">Non-Determinismo:</strong> L'uso di componenti stocastici (casuali) impedisce la validazione scientifica e la riproducibilità dei risultati.
                                    </li>
                                    <li>
                                        <strong className="text-white">Mancanza di Autenticità:</strong> L'uso superficiale di scale "esotiche" senza rispetto per le convenzioni performative reali.
                                    </li>
                                </ul>
                                <div className="mt-4 p-3 bg-brand-accent/10 border border-brand-accent/20 rounded">
                                    <p className="text-brand-accent font-bold mb-1">Contributo del Framework:</p>
                                    <p>Implementazione di algoritmi completamente deterministici (bit-perfect), integrazione di 48 tradizioni musicali validate e uso dello standard colorimetrico CIE LAB D65.</p>
                                </div>
                            </div>
                        </details>

                        {/* 2. FONDAMENTI METODOLOGICI */}
                        <details className="group bg-black/20 rounded-lg border border-white/10 overflow-hidden" id="doc-colorimetry">
                            <summary className="flex justify-between items-center p-4 cursor-pointer bg-white/5 hover:bg-white/10 transition-colors">
                                <h3 className="font-bold text-white">2. Fondamenti Metodologici (CIE LAB & Determinismo)</h3>
                                <i className="fas fa-chevron-down text-brand-text-secondary group-open:rotate-180 transition-transform"></i>
                            </summary>
                            <div className="p-6 text-sm text-brand-text-secondary space-y-4 leading-relaxed border-t border-white/5">
                                <h4 className="font-bold text-white">Colorimetria CIE LAB D65</h4>
                                <p>
                                    Abbandoniamo il modello RGB (dipendente dal dispositivo) per usare lo spazio colore <strong>CIE L*a*b*</strong> con Illuminante Standard D65. Questo garantisce che l'analisi sia percettivamente uniforme e corrisponda alla visione umana reale, indipendentemente dal monitor.
                                </p>
                                <ul className="list-disc pl-5 space-y-1 text-xs font-mono">
                                    <li>L* (Lightness) → Dinamica/Volume</li>
                                    <li>a* (Green-Red) / b* (Blue-Yellow) → Tonalità e Timbro</li>
                                </ul>

                                <h4 className="font-bold text-white mt-4" id="doc-determinism">Determinismo Computazionale</h4>
                                <p>
                                    Ogni trasformazione è una funzione matematica pura. È stato eliminato ogni uso di <code>Math.random()</code> non seedato.
                                </p>
                                <div className="bg-black p-3 rounded border border-white/10 font-mono text-xs text-green-400">
                                    ∀ Image I, ∀ Configuration C:<br />
                                    SonificART(I, C, t1) = SonificART(I, C, t2)<br />
                                    Dove l'uguaglianza è bit-perfect.
                                </div>
                            </div>
                        </details>

                        {/* 3. I 3 PARADIGMI */}
                        <details className="group bg-black/20 rounded-lg border border-white/10 overflow-hidden">
                            <summary className="flex justify-between items-center p-4 cursor-pointer bg-white/5 hover:bg-white/10 transition-colors">
                                <h3 className="font-bold text-white">3. I Tre Paradigmi di Sonificazione</h3>
                                <i className="fas fa-chevron-down text-brand-text-secondary group-open:rotate-180 transition-transform"></i>
                            </summary>
                            <div className="p-6 text-sm text-brand-text-secondary space-y-6 leading-relaxed border-t border-white/5">
                                <div>
                                    <h4 className="font-bold text-blue-300 mb-1">1. Scientifico (Comparative Analysis)</h4>
                                    <p>
                                        Priorità assoluta all'accuratezza. La piacevolezza audio è secondaria. Ogni variazione sonora corrisponde a una reale variazione nei dati visivi. Ideale per monitoraggio e ricerca.
                                    </p>
                                </div>
                                <div>
                                    <h4 className="font-bold text-purple-300 mb-1">2. Artistico (Il "Traduttore Cieco")</h4>
                                    <p>
                                        L'IA riceve solo i dati numerici (colori, complessità, tradizione) ma <strong>NON vede l'immagine originale</strong>. Il suo compito è "tradurre" i dati in musica senza essere influenzata dal soggetto visivo.
                                    </p>
                                </div>
                                <div>
                                    <h4 className="font-bold text-teal-300 mb-1">3. Ibrido (Il "Produttore Creativo")</h4>
                                    <p>
                                        L'IA vede l'immagine e riceve i dati scientifici. Agisce come un produttore che deve conciliare il "contesto visivo" (es. un tramonto) con il "vincolo tecnico" (es. la scala Raga Yaman imposta dai colori). Risolve la dissonanza semantica creando un'opera che unisce rigore ed emozione.
                                    </p>
                                </div>
                            </div>
                        </details>

                        {/* 4. PIPELINE 7 FASI */}
                        <details className="group bg-black/20 rounded-lg border border-white/10 overflow-hidden" id="doc-pipeline">
                            <summary className="flex justify-between items-center p-4 cursor-pointer bg-white/5 hover:bg-white/10 transition-colors">
                                <h3 className="font-bold text-white">4. Architettura: Pipeline a 7 Fasi</h3>
                                <i className="fas fa-chevron-down text-brand-text-secondary group-open:rotate-180 transition-transform"></i>
                            </summary>
                            <div className="p-0 border-t border-white/5">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-white/5 text-brand-text-secondary">
                                        <tr>
                                            <th className="p-3 font-bold border-b border-white/10">Fase</th>
                                            <th className="p-3 font-bold border-b border-white/10">Descrizione Tecnica</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-brand-text-secondary">
                                        <tr>
                                            <td className="p-3 font-bold text-white">1. Standardization</td>
                                            <td className="p-3">Resize immagine a 512x512px per coerenza matriciale.</td>
                                        </tr>
                                        <tr>
                                            <td className="p-3 font-bold text-white">2. Hash Calc</td>
                                            <td className="p-3">Calcolo impronta digitale SHA-256 su pixel raw + config.</td>
                                        </tr>
                                        <tr>
                                            <td className="p-3 font-bold text-white">3. Block Analysis</td>
                                            <td className="p-3">Divisione in griglia (es. 32x32) e calcolo media CIE LAB per blocco.</td>
                                        </tr>
                                        <tr>
                                            <td className="p-3 font-bold text-white">4. Universal Mapping</td>
                                            <td className="p-3">Conversione colore → nota base (0-11) e parametri microtonali.</td>
                                        </tr>
                                        <tr>
                                            <td className="p-3 font-bold text-white">5. Cultural Selection</td>
                                            <td className="p-3" id="doc-database">Algoritmo di matching contro database di 48 tradizioni musicali.</td>
                                        </tr>
                                        <tr>
                                            <td className="p-3 font-bold text-white">6. Cultural Transform</td>
                                            <td className="p-3">Applicazione scale, ornamenti (trilli, glissandi) e timing culturale.</td>
                                        </tr>
                                        <tr>
                                            <td className="p-3 font-bold text-white">7. Synthesis</td>
                                            <td className="p-3">Generazione audio PCM tramite Web Audio API e export SAC.</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </details>

                        {/* 5. CERTIFICAZIONE SAC */}
                        <details className="group bg-black/20 rounded-lg border border-white/10 overflow-hidden" id="doc-sac">
                            <summary className="flex justify-between items-center p-4 cursor-pointer bg-white/5 hover:bg-white/10 transition-colors">
                                <h3 className="font-bold text-white">5. Certificazione e Verifica (SAC)</h3>
                                <i className="fas fa-chevron-down text-brand-text-secondary group-open:rotate-180 transition-transform"></i>
                            </summary>
                            <div className="p-6 text-sm text-brand-text-secondary space-y-4 leading-relaxed border-t border-white/5">
                                <p>
                                    Per risolvere il problema della fiducia nel digitale, il framework produce un <strong>Sonified Art Container (SAC)</strong>. Non è un semplice file audio, ma un "contenitore notarile" (ZIP rinominato) auto-validante.
                                </p>

                                <h4 className="font-bold text-white mt-2">Contenuto del Container:</h4>
                                <ul className="space-y-2 text-xs font-mono bg-black/30 p-4 rounded border border-white/10">
                                    <li>├── original_image.jpg (Input standardizzato)</li>
                                    <li>├── generated_audio.wav (Master audio PCM)</li>
                                    <li>├── musical_notation.mid (Partitura vettoriale)</li>
                                    <li>├── sonification_data.json (Metadati completi)</li>
                                    <li>├── scan_visualization.mp4 (PROVA CINETICA FORENSE)</li>
                                    <li>└── integrity_manifest.json (Registro Hash SHA-256)</li>
                                </ul>

                                <h4 className="font-bold text-white mt-2">La Prova Cinetica (Kinetic Proof)</h4>
                                <p>
                                    Il video incluso non è un'animazione artistica, ma un <strong>audit visivo</strong>. Mostra in sovraimpressione (HUD) i dati di telemetria: Timestamp, Coordinate Griglia e Frequenza. Questo permette di verificare manualmente la causalità: l'utente può controllare che al secondo X, il cursore sia sul pixel Y e suoni la nota Z, dimostrando che il suono non è casuale.
                                </p>
                            </div>
                        </details>
                    </div>
                );
        }
    };

    return (
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 animate-backdrop-fade-in p-4"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-4xl bg-[#0f172a] rounded-xl shadow-2xl border border-white/10 animate-zoom-in flex flex-col max-h-[85vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-6 border-b border-white/10">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <i className="fas fa-book-reader text-brand-accent"></i>
                        {t('help.title')}
                    </h2>
                    <button onClick={onClose} className="text-white/50 hover:text-white text-2xl transition-colors">&times;</button>
                </div>

                <div className="flex border-b border-white/10 bg-white/5 px-6 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('guide')}
                        className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'guide' ? 'border-brand-accent text-white' : 'border-transparent text-brand-text-secondary hover:text-white'}`}
                    >
                        {t('help.tabs.guide')}
                    </button>
                    <button
                        onClick={() => setActiveTab('interface')}
                        className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'interface' ? 'border-brand-accent text-white' : 'border-transparent text-brand-text-secondary hover:text-white'}`}
                    >
                        {t('help.tabs.glossary')}
                    </button>
                    <button
                        onClick={() => setActiveTab('faq')}
                        className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'faq' ? 'border-brand-accent text-white' : 'border-transparent text-brand-text-secondary hover:text-white'}`}
                    >
                        {t('help.tabs.faq')}
                    </button>
                    <button
                        onClick={() => setActiveTab('scientific')}
                        className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'scientific' ? 'border-brand-accent text-white' : 'border-transparent text-brand-text-secondary hover:text-white'}`}
                    >
                        {t('help.tabs.science')}
                    </button>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar bg-[#0f172a]">
                    {renderContent()}
                </div>

                <div className="p-6 border-t border-white/10 bg-white/5 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg transition-colors">
                        {t('help.close')}
                    </button>
                </div>
            </div>
        </div>
    );
};