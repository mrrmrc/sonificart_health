import React, { useState } from 'react';
import { showcaseProjects } from '../data/showcaseData';
import { ShowcaseProject } from '../types';
import { generateParadigmPreview } from '../services/audioUtils';

const fixImage = (url: string) => url.startsWith('data:') || url.startsWith('http') ? url : `data:image/jpeg;base64,${url}`;

interface LandingPageProps {
    onGetStarted: () => void;
    onExplore: () => void;
    onOpenPricing: (plan?: string) => void; // Aggiornato per passare il piano
    onOpenDocs: (section?: string) => void;
}

const FeatureCard: React.FC<{ icon: string, title: string, desc: React.ReactNode, color: string, onClick?: () => void }> = ({ icon, title, desc, color, onClick }) => (
    <div onClick={onClick} className={`group relative bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 transition-all duration-500 hover:-translate-y-2 hover:bg-white/10 hover:border-white/20 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] overflow-hidden ${onClick ? 'cursor-pointer' : ''}`}>
        <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-${color}-500/20`}></div>
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-white/5 to-white/10 border border-white/10 flex items-center justify-center text-2xl mb-6 text-${color}-400 shadow-inner group-hover:scale-110 transition-transform duration-500`}><i className={`fas ${icon}`}></i></div>
        <h3 className="text-xl font-display font-bold text-white mb-3 group-hover:text-brand-accent transition-colors flex items-center gap-2">{title}</h3>
        <div className="text-sm text-brand-text-secondary leading-relaxed group-hover:text-white/80 transition-colors">{desc}</div>
    </div>
);

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onExplore, onOpenPricing, onOpenDocs }) => {
    const [billingCycle, setBillingCycle] = useState<'Mensile' | 'Annuale'>('Mensile');

    return (
        <div className="w-full font-sans overflow-x-hidden text-white selection:bg-brand-accent selection:text-brand-primary">

            {/* HERO */}
            <div className="relative min-h-[85vh] flex flex-col justify-center items-center pt-32 pb-20 z-20 text-center px-6 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-accent/10 rounded-full blur-[120px] animate-pulse-glow pointer-events-none"></div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8 shadow-lg"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span><span className="text-xs font-bold tracking-widest text-green-400 uppercase">Framework v1.0 Stable</span></div>
                <h1 className="font-display text-6xl md:text-8xl lg:text-9xl font-black text-white mb-6 leading-tight tracking-tighter drop-shadow-2xl z-10">Il Suono <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-accent via-white to-purple-400">Dell'Invisibile</span></h1>
                <p className="text-lg md:text-2xl text-brand-text-secondary max-w-3xl mx-auto font-light mb-12 z-10">Trasforma ogni pixel in frequenza. Il primo framework deterministico per la <strong className="text-white">sonificazione scientifica</strong> e <strong className="text-white">artistica</strong>.</p>
                <div className="flex flex-col sm:flex-row gap-6 z-10">
                    <button onClick={onGetStarted} className="px-10 py-5 bg-brand-accent text-brand-primary font-black text-base md:text-lg rounded-full hover:bg-brand-accent-light hover:scale-105 transition-all flex items-center justify-center gap-3"><i className="fas fa-play"></i> INIZIA A CREARE</button>
                    <button onClick={onExplore} className="px-10 py-5 bg-white/5 border border-white/10 text-white font-bold text-base md:text-lg rounded-full hover:bg-white/10 hover:border-white/30 transition-all flex items-center justify-center gap-3"><i className="fas fa-compass"></i> ESPLORA VETRINA</button>
                </div>
            </div>

            {/* FEATURES GRID */}
            <div className="w-full max-w-7xl mx-auto px-6 py-24 relative z-20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <FeatureCard icon="fa-microscope" title="Colorimetria CIE LAB D65" desc="Analisi percettivamente uniforme e scientificamente validata." color="teal" onClick={() => onOpenDocs('doc-colorimetry')} />
                    <FeatureCard icon="fa-globe-americas" title="Database Etnomusicologico" desc="48 tradizioni musicali mondiali per un matching culturale preciso." color="purple" onClick={() => onOpenDocs('doc-database')} />
                    <FeatureCard icon="fa-fingerprint" title="Determinismo Bit-Perfect" desc="Output sempre identico e certificato su blockchain simulata." color="blue" onClick={() => onOpenDocs('doc-determinism')} />
                </div>
            </div>

            {/* PRICING */}
            <div className="w-full bg-gradient-to-b from-transparent to-black/40 py-24 border-t border-white/5">
                <div className="w-full max-w-7xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-4">Piani di Accesso</h2>
                        <p className="text-brand-text-secondary mb-6">Scegli la potenza di calcolo adatta al tuo progetto.</p>

                        <div className="inline-flex bg-white/10 p-1 rounded-full border border-white/10">
                            <button onClick={() => setBillingCycle('Mensile')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${billingCycle === 'Mensile' ? 'bg-brand-accent text-brand-primary shadow-lg' : 'text-white hover:text-white/80'}`}>Mensile</button>
                            <button onClick={() => setBillingCycle('Annuale')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${billingCycle === 'Annuale' ? 'bg-brand-accent text-brand-primary shadow-lg' : 'text-white hover:text-white/80'}`}>Annuale (-20%)</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                        {/* GRATIS */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 flex flex-col hover:border-white/20 transition-colors">
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-white">Gratis</h3>
                                <div className="text-3xl font-black text-white mt-2">€ 0</div>
                                <p className="text-xs text-brand-text-secondary mt-1">Per sperimentazione personale</p>
                            </div>
                            <ul className="space-y-4 text-sm text-brand-text-secondary flex-grow mb-8">
                                <li className="flex gap-3"><i className="fas fa-check text-green-400"></i> <span><strong>5 Crediti</strong> Omaggio</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-green-400"></i> <span>Paradigma Scientifico Base</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-green-400"></i> <span>Export MP3 Standard</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-green-400"></i> <span>Accesso alla Community</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-green-400"></i> <span>Visualizzatore 2D</span></li>
                            </ul>
                            <button onClick={onGetStarted} className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors">Crea Account</button>
                        </div>

                        {/* PRO */}
                        <div className="bg-brand-secondary/80 backdrop-blur-xl border border-brand-accent/50 rounded-2xl p-8 flex flex-col relative transform scale-105 shadow-2xl shadow-brand-accent/10 z-10">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand-accent text-brand-primary text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wide shadow-lg">Consigliato</div>
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-white text-brand-accent">Pro</h3>
                                <div className="text-3xl font-black text-white mt-2">
                                    {billingCycle === 'Mensile' ? '€ 8.80' : '€ 88.00'}
                                    <span className="text-sm font-normal text-gray-400"> / {billingCycle === 'Mensile' ? 'mese' : 'anno'}</span>
                                </div>
                                <p className="text-xs text-brand-text-secondary mt-1">Per professionisti e creativi</p>
                            </div>
                            <ul className="space-y-4 text-sm text-white/90 flex-grow mb-8">
                                <li className="flex gap-3"><i className="fas fa-infinity text-brand-accent"></i> <span><strong>Crediti Illimitati</strong></span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-brand-accent"></i> <span>Tutti i Paradigmi (AI + Ibrido)</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-brand-accent"></i> <span>Export WAV 24bit / MIDI</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-brand-accent"></i> <span>Licenza Commerciale</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-brand-accent"></i> <span>Generazione Video 4K</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-brand-accent"></i> <span>Priorità di Calcolo</span></li>
                            </ul>
                            {/* Passa il piano scelto al click */}
                            <button onClick={() => onOpenPricing(billingCycle)} className="w-full py-4 bg-brand-accent hover:bg-brand-accent-light text-brand-primary font-bold rounded-xl transition-colors shadow-lg shadow-brand-accent/20">
                                Richiedi Accesso PRO
                            </button>
                        </div>

                        {/* ENTERPRISE */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 flex flex-col hover:border-white/20 transition-colors">
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-white">Istituzioni</h3>
                                <div className="text-3xl font-black text-white mt-2">Custom</div>
                                <p className="text-xs text-brand-text-secondary mt-1">Per Musei e Grandi Eventi</p>
                            </div>
                            <ul className="space-y-4 text-sm text-brand-text-secondary flex-grow mb-8">
                                <li className="flex gap-3"><i className="fas fa-check text-white"></i> <span>Piattaforma <strong>SaaS</strong> Dedicata</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-white"></i> <span>Installazioni Interattive</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-white"></i> <span>Supporto Hardware</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-white"></i> <span>API Access Esclusivo</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-white"></i> <span>Formazione Staff</span></li>
                            </ul>
                            <button onClick={() => onOpenPricing('Enterprise')} className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors">Contattaci</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};