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
    const [showVideoModal, setShowVideoModal] = useState(false);
    const { t } = useLanguage();

    // Usa SOLO le opere reali dal database (max 8)
    const displayProjects = (latestProjects && latestProjects.length > 0)
        ? latestProjects.slice(0, 8)
        : [];

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
                            <button onClick={() => setShowVideoModal(true)} className="px-8 py-4 bg-white/5 border border-white/10 text-white font-bold text-lg rounded-xl hover:bg-white/10 hover:border-white/20 transition-all flex items-center gap-3 backdrop-blur-sm">
                                <i className="fas fa-play-circle"></i> {t('landing.cta_explore')}
                            </button>
                        </div>

                        {/* USE CASES - Integrati nell'Hero come riga compatta */}
                        <div className="mt-10 pt-8 border-t border-white/10">
                            <p className="text-xs text-gray-500 uppercase tracking-widest mb-4 font-bold">{t('landing.use_cases.title')}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="flex items-center gap-2 text-sm text-gray-400 hover:text-yellow-400 transition-colors cursor-default">
                                    <i className="fas fa-palette text-yellow-500"></i>
                                    <span className="text-xs">{t('landing.use_cases.case1_title')}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-400 hover:text-blue-400 transition-colors cursor-default">
                                    <i className="fas fa-universal-access text-blue-500"></i>
                                    <span className="text-xs">{t('landing.use_cases.case2_title')}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-400 hover:text-purple-400 transition-colors cursor-default">
                                    <i className="fas fa-link text-purple-500"></i>
                                    <span className="text-xs">{t('landing.use_cases.case3_title')}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-400 hover:text-green-400 transition-colors cursor-default">
                                    <i className="fas fa-flask text-green-500"></i>
                                    <span className="text-xs">{t('landing.use_cases.case4_title')}</span>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* RIGHT: PREMIUM GLASSMORPHISM SHOWCASE */}
                    <div className="relative animate-fade-in-right w-full flex items-center justify-center">
                        {/* Animated Glow Background */}
                        <div className="absolute inset-0 overflow-hidden rounded-3xl">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-brand-accent/30 via-purple-600/20 to-pink-500/20 rounded-full blur-[80px] animate-pulse-slow"></div>
                        </div>

                        <div className="relative z-10 w-full max-w-md">
                            {/* Main Glassmorphism Card */}
                            <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                                {/* Decorative Corner Glow */}
                                <div className="absolute -top-20 -right-20 w-40 h-40 bg-brand-accent/30 rounded-full blur-3xl"></div>
                                <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl"></div>

                                {/* Header with Icon */}
                                <div className="relative flex items-center gap-4 mb-8">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-accent to-teal-600 flex items-center justify-center shadow-lg shadow-brand-accent/30">
                                        <i className="fas fa-fingerprint text-2xl text-white"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">Un Suono Unico per Ogni Immagine</h3>
                                        <p className="text-sm text-gray-300">Certificabile, Ripetibile, Verificabile</p>
                                    </div>
                                </div>

                                {/* Feature Pills - Più diretti */}
                                <div className="space-y-3 mb-8">
                                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:border-yellow-500/30 transition-colors group">
                                        <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                                            <i className="fas fa-certificate text-yellow-400 text-sm"></i>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-white group-hover:text-yellow-400 transition-colors">Certificazione</p>
                                            <p className="text-xs text-gray-300">Prova l'autenticità di un file digitale</p>
                                        </div>
                                        <i className="fas fa-check-circle text-yellow-400"></i>
                                    </div>

                                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:border-blue-500/30 transition-colors group">
                                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                            <i className="fas fa-flask text-blue-400 text-sm"></i>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">Ricerca</p>
                                            <p className="text-xs text-gray-300">Esperimenti ripetibili e misurabili</p>
                                        </div>
                                        <i className="fas fa-check-circle text-blue-400"></i>
                                    </div>

                                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:border-pink-500/30 transition-colors group">
                                        <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center">
                                            <i className="fas fa-palette text-pink-400 text-sm"></i>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-white group-hover:text-pink-400 transition-colors">Arte</p>
                                            <p className="text-xs text-gray-300">Nuovi linguaggi creativi cross-modali</p>
                                        </div>
                                        <i className="fas fa-check-circle text-pink-400"></i>
                                    </div>
                                </div>

                                {/* Bottom Badge */}
                                <div className="flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-brand-accent/10 to-purple-500/10 rounded-xl border border-brand-accent/20">
                                    <i className="fas fa-globe text-brand-accent"></i>
                                    <span className="text-sm font-medium text-gray-200">48 tradizioni musicali globali</span>
                                </div>
                            </div>

                            {/* Floating Mini Cards */}
                            <div className="absolute -top-4 -right-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl px-3 py-2 shadow-xl animate-float">
                                <span className="text-xs font-bold text-white flex items-center gap-1">
                                    <i className="fas fa-music text-brand-accent"></i> 48 Scale
                                </span>
                            </div>
                            <div className="absolute -bottom-4 -left-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl px-3 py-2 shadow-xl animate-float animation-delay-1000">
                                <span className="text-xs font-bold text-white flex items-center gap-1">
                                    <i className="fas fa-globe text-purple-400"></i> Globale
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* FEATURES GRID - Spostato in prima posizione - Glassmorphism */}
            <div className="w-full max-w-7xl mx-auto px-6 py-16 relative z-20">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-4">
                        <i className="fas fa-flask text-brand-accent text-xs"></i>
                        <span className="text-[10px] font-bold tracking-[0.2em] text-gray-400 uppercase">Tecnologia Brevettata</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-display font-black text-white mb-3">I Pilastri Scientifici</h2>
                    <p className="text-gray-400 max-w-xl mx-auto">Tre innovazioni che rendono SonificA.R.T. unico al mondo.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <FeatureCard icon="fa-microscope" title={t('landing.features.color')} desc={t('landing.features.color_desc')} color="teal" onClick={() => onOpenDocs('doc-colorimetry')} />
                    <FeatureCard icon="fa-globe-americas" title={t('landing.features.culture')} desc={t('landing.features.culture_desc')} color="purple" onClick={() => onOpenDocs('doc-database')} />
                    <FeatureCard icon="fa-fingerprint" title={t('landing.features.deter')} desc={t('landing.features.deter_desc')} color="pink" onClick={() => onOpenDocs('doc-determinism')} />
                </div>
            </div>

            {/* === LIVE PERFORMANCE SECTION === */}
            <div className="w-full py-20 relative z-20 overflow-hidden">
                {/* Animated Background */}
                <div className="absolute inset-0 bg-gradient-to-r from-pink-900/20 via-purple-900/30 to-pink-900/20"></div>
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-[100px] animate-pulse-slow"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px] animate-pulse-slow animation-delay-1000"></div>

                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        {/* LEFT: Text Content */}
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/20 border border-pink-500/30 backdrop-blur-md mb-6">
                                <i className="fas fa-broadcast-tower text-pink-400 text-xs"></i>
                                <span className="text-[10px] font-bold tracking-[0.2em] text-pink-300 uppercase">Esperienza Immersiva</span>
                            </div>

                            <h2 className="text-4xl md:text-5xl font-display font-black text-white mb-6 leading-tight">
                                Il tuo <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">corpo</span> diventa lo strumento
                            </h2>

                            <p className="text-lg text-gray-300 mb-8 leading-relaxed">
                                Con la <strong className="text-white">Modalità Live Performance</strong>, la tua webcam trasforma ogni movimento in musica.
                                Guarda l'opera, muovi la testa, sorridi — e ascolta come il suono risponde a <em>te</em>.
                            </p>

                            {/* Features List */}
                            <div className="space-y-4 mb-8">
                                <div className="flex items-start gap-4 p-4 bg-white/5 rounded-xl border border-white/10 hover:border-blue-500/30 transition-colors group">
                                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                        <i className="fas fa-eye text-xl text-blue-400"></i>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white group-hover:text-blue-400 transition-colors">👁️ Tracciamento Oculare</h4>
                                        <p className="text-sm text-gray-400">Lo sguardo controlla il panneggio stereo e i filtri sonori. Guarda a sinistra: il suono si sposta a sinistra.</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4 p-4 bg-white/5 rounded-xl border border-white/10 hover:border-green-500/30 transition-colors group">
                                    <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                                        <i className="fas fa-head-side text-xl text-green-400"></i>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white group-hover:text-green-400 transition-colors">🗣️ Movimento della Testa</h4>
                                        <p className="text-sm text-gray-400">Inclina la testa per cambiare ottava, ruotala per modulare delay e chorus in tempo reale.</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4 p-4 bg-white/5 rounded-xl border border-white/10 hover:border-yellow-500/30 transition-colors group">
                                    <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                                        <i className="fas fa-smile text-xl text-yellow-400"></i>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white group-hover:text-yellow-400 transition-colors">😊 Espressioni Facciali</h4>
                                        <p className="text-sm text-gray-400">Sorridi per passare a modo maggiore, alza le sopracciglia per aumentare tensione armonica.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Instructions */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mt-6">
                                <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                                    <i className="fas fa-info-circle text-brand-accent"></i>
                                    Come funziona?
                                </h4>
                                <ol className="text-sm text-gray-300 space-y-2">
                                    <li className="flex items-start gap-2">
                                        <span className="w-5 h-5 rounded-full bg-brand-accent/20 text-brand-accent text-xs flex items-center justify-center shrink-0 mt-0.5">1</span>
                                        <span>Scegli un'opera dalla <strong className="text-white">Galleria</strong></span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="w-5 h-5 rounded-full bg-brand-accent/20 text-brand-accent text-xs flex items-center justify-center shrink-0 mt-0.5">2</span>
                                        <span>Clicca su <strong className="text-pink-400">"Apri Console Live"</strong></span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="w-5 h-5 rounded-full bg-brand-accent/20 text-brand-accent text-xs flex items-center justify-center shrink-0 mt-0.5">3</span>
                                        <span>Attiva la webcam e suona con il tuo corpo!</span>
                                    </li>
                                </ol>
                            </div>

                            <button
                                onClick={onExplore}
                                className="mt-4 px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl border border-white/20 transition-all flex items-center gap-3"
                            >
                                <i className="fas fa-images"></i>
                                Vai alla Galleria
                            </button>
                        </div>

                        {/* RIGHT: Visual Representation */}
                        <div className="relative flex items-center justify-center">
                            {/* Central Icon */}
                            <div className="relative w-72 h-72 md:w-96 md:h-96">
                                {/* Animated Rings */}
                                <div className="absolute inset-0 rounded-full border-2 border-pink-500/30 animate-ping" style={{ animationDuration: '3s' }}></div>
                                <div className="absolute inset-4 rounded-full border-2 border-purple-500/30 animate-ping" style={{ animationDuration: '3s', animationDelay: '0.5s' }}></div>
                                <div className="absolute inset-8 rounded-full border-2 border-blue-500/30 animate-ping" style={{ animationDuration: '3s', animationDelay: '1s' }}></div>

                                {/* Center Face */}
                                <div className="absolute inset-12 rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20 backdrop-blur-xl border border-white/20 flex flex-col items-center justify-center">
                                    <i className="fas fa-user text-6xl md:text-7xl text-white/80 mb-4"></i>
                                    <span className="text-sm text-white/60 font-medium">Tu + Webcam</span>
                                </div>

                                {/* Floating Labels */}
                                <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-500/20 backdrop-blur-xl border border-blue-500/30 rounded-lg px-3 py-2 animate-float">
                                    <span className="text-xs text-blue-300 font-bold flex items-center gap-1">
                                        <i className="fas fa-eye"></i> Eye Tracking
                                    </span>
                                </div>
                                <div className="absolute top-1/2 -right-4 -translate-y-1/2 bg-green-500/20 backdrop-blur-xl border border-green-500/30 rounded-lg px-3 py-2 animate-float animation-delay-1000">
                                    <span className="text-xs text-green-300 font-bold flex items-center gap-1">
                                        <i className="fas fa-arrows-alt"></i> Head Pose
                                    </span>
                                </div>
                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-500/20 backdrop-blur-xl border border-yellow-500/30 rounded-lg px-3 py-2 animate-float" style={{ animationDelay: '0.5s' }}>
                                    <span className="text-xs text-yellow-300 font-bold flex items-center gap-1">
                                        <i className="fas fa-smile"></i> Emotions
                                    </span>
                                </div>
                                <div className="absolute top-1/2 -left-4 -translate-y-1/2 bg-pink-500/20 backdrop-blur-xl border border-pink-500/30 rounded-lg px-3 py-2 animate-float" style={{ animationDelay: '1.5s' }}>
                                    <span className="text-xs text-pink-300 font-bold flex items-center gap-1">
                                        <i className="fas fa-music"></i> Audio Out
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* === SHOWCASE SECTION (GALLERY) === */}
            <div className="w-full bg-slate-950/40 backdrop-blur-sm py-20 border-t border-white/5 relative z-20">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
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


            {/* PROCESS EXPLANATION SECTION - The "Audio Footprint" concept */}
            <div className="w-full py-32 bg-gradient-to-b from-transparent to-brand-primary/20 relative overflow-hidden border-t border-white/5">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-accent/5 rounded-full blur-[150px] pointer-events-none"></div>
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="text-center mb-20">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-6">
                            <i className="fas fa-microscope text-brand-accent text-xs"></i>
                            <span className="text-[10px] font-bold tracking-[0.2em] text-gray-400 uppercase">Metodologia Scientifica</span>
                        </div>
                        <h2 className="text-4xl md:text-6xl font-display font-black text-white mb-6 uppercase tracking-tighter">
                            {t('landing.process.title')}
                        </h2>
                        <p className="text-xl text-gray-400 max-w-2xl mx-auto font-light leading-relaxed">
                            {t('landing.process.subtitle')}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 ">
                        {/* Step 1 */}
                        <div className="group bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-[2.5rem] hover:bg-white/10 hover:border-brand-accent/30 transition-all duration-500 hover:-translate-y-3">
                            <div className="w-20 h-20 rounded-3xl bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center text-4xl text-brand-accent mb-8 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_30px_rgba(13,148,136,0.1)]">
                                <i className="fas fa-fingerprint"></i>
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-brand-accent transition-colors">
                                {t('landing.process.step1_title')}
                            </h3>
                            <p className="text-gray-400 leading-relaxed group-hover:text-white/90 transition-colors italic">
                                "{t('landing.process.step1_desc')}"
                            </p>
                        </div>

                        {/* Step 2 */}
                        <div className="group bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-[2.5rem] hover:bg-white/10 hover:border-purple-500/30 transition-all duration-500 hover:-translate-y-3">
                            <div className="w-20 h-20 rounded-3xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-4xl text-purple-400 mb-8 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_30px_rgba(168,85,247,0.1)]">
                                <i className="fas fa-brain"></i>
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-purple-400 transition-colors">
                                {t('landing.process.step2_title')}
                            </h3>
                            <p className="text-gray-400 leading-relaxed group-hover:text-white/90 transition-colors">
                                {t('landing.process.step2_desc')}
                            </p>
                        </div>

                        {/* Step 3 */}
                        <div className="group bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-[2.5rem] hover:bg-white/10 hover:border-pink-500/30 transition-all duration-500 hover:-translate-y-3">
                            <div className="w-20 h-20 rounded-3xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-4xl text-pink-400 mb-8 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_30px_rgba(236,72,153,0.1)]">
                                <i className="fas fa-certificate"></i>
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-pink-400 transition-colors">
                                {t('landing.process.step3_title')}
                            </h3>
                            <p className="text-gray-400 leading-relaxed group-hover:text-white/90 transition-colors">
                                {t('landing.process.step3_desc')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>


            {/* VIDEO MODAL POPUP */}
            {showVideoModal && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in"
                    onClick={() => setShowVideoModal(false)}
                >
                    <div
                        className="relative w-full max-w-5xl mx-4 bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 animate-zoom-in"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Close Button */}
                        <button
                            onClick={() => setShowVideoModal(false)}
                            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-all hover:scale-110"
                        >
                            <i className="fas fa-times text-lg"></i>
                        </button>

                        {/* Video Player */}
                        <div className="aspect-video w-full bg-black">
                            <video
                                className="w-full h-full"
                                controls
                                autoPlay
                                src="/videos/presentasonificart.mp4"
                            >
                                Il tuo browser non supporta il tag video.
                            </video>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 bg-gradient-to-t from-black to-transparent">
                            <h3 className="text-xl font-bold text-white mb-2">
                                <i className="fas fa-play-circle text-brand-accent mr-2"></i>
                                Come Funziona SonificA.R.T.
                            </h3>
                            <p className="text-gray-400 text-sm">
                                Scopri come trasformiamo le immagini in composizioni musicali uniche e verificabili.
                            </p>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};