import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { ShowcaseProject } from '../types';
import BackgroundGrid from './BackgroundGrid';

interface LandingPageProps {
    onGetStarted: () => void;
    onExplore: () => void;
    onOpenPricing: (plan?: string) => void;
    onOpenDocs: (section?: string) => void;
    latestProjects?: ShowcaseProject[];
    onSelectProject: (id: string) => void;
}

// Reusable Feature Card Component for the bottom grid
const FeatureCard: React.FC<{ icon: string, title: string, desc: React.ReactNode, color: string, onClick?: () => void }> = ({ icon, title, desc, color, onClick }) => (
    <div onClick={onClick} className={`group relative bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 transition-all duration-500 hover:-translate-y-2 hover:bg-white/10 hover:border-white/20 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] overflow-hidden ${onClick ? 'cursor-pointer' : ''}`}>
        <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-${color}-500/20`}></div>
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-white/5 to-white/10 border border-white/10 flex items-center justify-center text-2xl mb-6 text-${color}-400 shadow-inner group-hover:scale-110 transition-transform duration-500`}><i className={`fas ${icon}`}></i></div>
        <h3 className="text-xl font-display font-bold text-white mb-3 group-hover:text-brand-accent transition-colors flex items-center gap-2">{title}</h3>
        <div className="text-sm text-brand-text-secondary leading-relaxed group-hover:text-white/80 transition-colors">{desc}</div>
    </div>
);

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onExplore, onOpenPricing, onOpenDocs, latestProjects, onSelectProject }) => {
    const [billingCycle, setBillingCycle] = useState<'Mensile' | 'Annuale'>('Mensile');
    const { t } = useLanguage();

    // FALLBACK PLACEHOLDERS if no data
    const displayProjects = (latestProjects && latestProjects.length > 0) ? latestProjects : [
        { id: 'p1', title: 'Symphony of Chaos', imageUrl: 'https://images.unsplash.com/photo-1549490349-8643362247b5', paradigm: 'artistic', author: 'AI Artist' },
        { id: 'p2', title: 'Neural Landscapes', imageUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853', paradigm: 'hybrid', author: 'DataSonifier' },
        { id: 'p3', title: 'Quantum Harmony', imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa', paradigm: 'scientific', author: 'Dr. Sound' },
        { id: 'p4', title: 'Digital Dreams', imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475', paradigm: 'artistic', author: 'CreativeBot' }
    ];

    return (
        <div className="w-full font-sans overflow-x-hidden text-white selection:bg-brand-accent selection:text-brand-primary">

            {/* GLOBAL BACKGROUND GRID */}
            <BackgroundGrid />

            {/* HERO SECTION */}
            <div className="relative min-h-[100vh] flex items-center pt-24 pb-20 overflow-hidden">
                {/* Ambient Background */}
                <div className="absolute top-[-20%] right-[-10%] w-[1000px] h-[1000px] bg-brand-accent/10 rounded-full blur-[120px] pointer-events-none animate-blob"></div>
                <div className="absolute bottom-[-20%] left-[-10%] w-[800px] h-[800px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none animate-blob animation-delay-2000"></div>

                <div className="max-w-7xl mx-auto w-full px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">

                    {/* LEFT: TEXT CONTENT */}
                    <div className="text-left animate-fade-in-left">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8 shadow-[0_0_20px_rgba(13,148,136,0.2)]">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-accent"></span>
                            </span>
                            <span className="text-[10px] font-bold tracking-[0.2em] text-brand-accent uppercase">{t('landing.badge')}</span>
                        </div>

                        <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl font-black text-white mb-8 leading-[0.9] tracking-tighter">
                            {t('landing.title_start')} <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-accent to-purple-500 relative">
                                {t('landing.title_end')}
                                <svg className="absolute w-full h-3 -bottom-1 left-0 text-brand-accent opacity-40" viewBox="0 0 100 10" preserveAspectRatio="none">
                                    <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="4" fill="none" />
                                </svg>
                            </span>
                        </h1>

                        <p className="text-xl text-gray-400 font-light mb-10 max-w-lg leading-relaxed">
                            <span dangerouslySetInnerHTML={{ __html: t('landing.subtitle') }} />
                        </p>

                        <div className="flex flex-col sm:flex-row gap-5">
                            <button onClick={onGetStarted} className="group relative px-8 py-4 bg-brand-accent text-brand-primary font-black text-lg rounded-xl overflow-hidden shadow-[0_0_40px_rgba(13,148,136,0.3)] transition-all hover:scale-105 hover:shadow-[0_0_60px_rgba(13,148,136,0.5)]">
                                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer"></span>
                                <span className="relative flex items-center gap-3">
                                    <i className="fas fa-play"></i> {t('landing.cta_start')}
                                </span>
                            </button>
                            <button onClick={onExplore} className="px-8 py-4 bg-white/5 border border-white/10 text-white font-bold text-lg rounded-xl hover:bg-white/10 hover:border-white/20 transition-all flex items-center gap-3 backdrop-blur-sm">
                                <i className="fas fa-compass"></i> {t('landing.cta_explore')}
                            </button>
                        </div>

                        <div className="mt-12 flex items-center gap-4 text-sm text-gray-500 font-medium">
                            <div className="flex -space-x-3">
                                {[1, 2, 3].map(i => <div key={i} className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-950 flex items-center justify-center text-[10px] text-gray-400"><i className="fas fa-user"></i></div>)}
                            </div>
                            <p>Unisciti a <span className="text-white font-bold">2,000+</span> artisti digitali</p>
                        </div>
                    </div>

                    {/* RIGHT: DYNAMIC FEATURE LIST - "What It Actually Does" */}
                    <div className="relative animate-fade-in-right w-full h-[600px] flex items-center justify-center perspective-1000">
                        {/* Dynamic Background Elements - "Living Ecosystem" */}
                        <div className="absolute inset-0 overflow-hidden rounded-3xl">
                            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-accent/10 via-transparent to-transparent animate-spin-slow opacity-50"></div>
                            <div className="absolute top-10 right-10 w-72 h-72 bg-purple-600/20 rounded-full blur-[100px] animate-blob mix-blend-screen"></div>
                            <div className="absolute bottom-10 left-10 w-72 h-72 bg-brand-accent/20 rounded-full blur-[100px] animate-blob animation-delay-2000 mix-blend-screen"></div>
                            {/* Grid Overlay */}
                            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:40px_40px]"></div>
                        </div>

                        {/* THE FEATURE LIST */}
                        <div className="relative z-10 w-full max-w-lg space-y-4">

                            {/* Header Label */}
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-6 ml-2">Core Capabilities</div>

                            {/* Item 1: Smart Vision (Guided Capture) */}
                            <div className="group relative bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-xl hover:bg-white/10 hover:border-brand-accent/50 transition-all duration-300 cursor-default hover:translate-x-2">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-accent rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-brand-accent/10 flex items-center justify-center text-brand-accent text-xl group-hover:scale-110 transition-transform">
                                        <i className="fas fa-eye"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold text-lg leading-tight group-hover:text-brand-accent transition-colors">Analisi Ottica Real-time</h3>
                                        <p className="text-gray-400 text-sm mt-1">Feedback biometrico su entropia, contrasto e bilanciamento.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Item 2: Spectral Transcoding (The Core) */}
                            <div className="group relative bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-xl hover:bg-white/10 hover:border-purple-500/50 transition-all duration-300 cursor-default hover:translate-x-2">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500 rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 text-xl group-hover:scale-110 transition-transform">
                                        <i className="fas fa-wave-square"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold text-lg leading-tight group-hover:text-purple-400 transition-colors">Transcodifica Spettrale</h3>
                                        <p className="text-gray-400 text-sm mt-1">Conversione matematica da pixel a frequenze sonore.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Item 3: AI Hybrid Synthesis (Integration) */}
                            <div className="group relative bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-xl hover:bg-white/10 hover:border-pink-500/50 transition-all duration-300 cursor-default hover:translate-x-2">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-pink-500 rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-400 text-xl group-hover:scale-110 transition-transform">
                                        <i className="fas fa-microchip"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold text-lg leading-tight group-hover:text-pink-400 transition-colors">Sintesi AI Ibrida</h3>
                                        <p className="text-gray-400 text-sm mt-1">Co-creazione musicale assistita da Intelligenza Artificiale.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Item 4: Multi-Format Export */}
                            <div className="group relative bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-xl hover:bg-white/10 hover:border-blue-500/50 transition-all duration-300 cursor-default hover:translate-x-2">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 text-xl group-hover:scale-110 transition-transform">
                                        <i className="fas fa-share-nodes"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold text-lg leading-tight group-hover:text-blue-400 transition-colors">Export Multimediale</h3>
                                        <p className="text-gray-400 text-sm mt-1">Generazione automatica di Video, WAV e spartiti MIDI.</p>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>

            {/* SHOWCASE SECTION */}
            <div className="w-full bg-slate-950/40 backdrop-blur-sm py-32 border-t border-white/5 relative z-20">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
                        <div>
                            <h2 className="text-4xl font-display font-black text-white mb-4">Galleria</h2>
                            <p className="text-gray-400 text-lg max-w-md">Esplora le ultime sonificazioni create dalla community. Arte che puoi ascoltare.</p>
                        </div>
                        <button onClick={onExplore} className="text-brand-accent font-bold text-lg hover:text-white transition-colors flex items-center gap-3 group">
                            Vedi tutte le opere <i className="fas fa-arrow-right group-hover:translate-x-2 transition-transform"></i>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                        {displayProjects.map((p: any) => (
                            <div key={p.id} onClick={() => onSelectProject(p.id)} className="group relative aspect-[4/5] bg-black rounded-2xl overflow-hidden cursor-pointer border border-white/10 hover:border-brand-accent/50 hover:shadow-[0_10px_40px_-10px_rgba(13,148,136,0.3)] transition-all duration-500">
                                <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent p-6 flex flex-col justify-end translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                                    <span className="text-[10px] text-brand-accent font-black uppercase mb-2 tracking-widest">{p.paradigm}</span>
                                    <h3 className="text-white font-display font-bold text-xl leading-tight mb-1">{p.title}</h3>
                                    <p className="text-xs text-gray-400">{p.author}</p>
                                </div>
                                <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all duration-500 delay-100">
                                    <i className="fas fa-play text-xs text-white"></i>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* FEATURES GRID - Glassmorphism */}
            <div className="w-full max-w-7xl mx-auto px-6 py-24 relative z-20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <FeatureCard icon="fa-microscope" title={t('landing.features.color')} desc={t('landing.features.color_desc')} color="teal" onClick={() => onOpenDocs('doc-colorimetry')} />
                    <FeatureCard icon="fa-globe-americas" title={t('landing.features.culture')} desc={t('landing.features.culture_desc')} color="purple" onClick={() => onOpenDocs('doc-database')} />
                    <FeatureCard icon="fa-fingerprint" title={t('landing.features.deter')} desc={t('landing.features.deter_desc')} color="pink" onClick={() => onOpenDocs('doc-determinism')} />
                </div>
            </div>

        </div>
    );
};