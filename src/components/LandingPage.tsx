import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { ShowcaseProject } from '../types';

interface LandingPageProps {
    onGetStarted: () => void;
    onExplore: () => void;
    onOpenPricing: (plan?: string) => void;
    onOpenDocs: (section?: string) => void;
    latestProjects?: ShowcaseProject[];
    onSelectProject: (id: string) => void;
}

// ... FeatureCard remains same ...
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

            {/* HERO SPLIT (LEFT TEXT, RIGHT VIDEO) */}
            <div className="relative min-h-[90vh] flex items-center pt-32 pb-20 z-20 px-6 overflow-hidden">
                <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[800px] h-[800px] bg-brand-accent/5 rounded-full blur-[120px] pointer-events-none"></div>

                <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                    {/* LEFT CONTENT */}
                    <div className="text-left animate-fade-in-left relative z-20">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8 shadow-lg"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span><span className="text-xs font-bold tracking-widest text-green-400 uppercase">{t('landing.badge')}</span></div>

                        <h1 className="font-display text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white mb-6 leading-tight tracking-tighter drop-shadow-2xl">
                            {t('landing.title_start')} <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-accent via-white to-purple-400">
                                {t('landing.title_end')}
                            </span>
                        </h1>

                        <p className="text-lg md:text-xl text-brand-text-secondary font-light mb-10 max-w-xl leading-relaxed">
                            <span dangerouslySetInnerHTML={{ __html: t('landing.subtitle') }} />
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <button onClick={onGetStarted} className="px-8 py-4 bg-brand-accent text-brand-primary font-black text-lg rounded-full hover:bg-brand-accent-light hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-accent/20"><i className="fas fa-play"></i> {t('landing.cta_start')}</button>
                            <button onClick={onExplore} className="px-8 py-4 bg-white/5 border border-white/10 text-white font-bold text-lg rounded-full hover:bg-white/10 hover:border-white/30 transition-all flex items-center justify-center gap-2"><i className="fas fa-compass"></i> {t('landing.cta_explore')}</button>
                        </div>
                    </div>

                    {/* RIGHT VIDEO */}
                    <div className="relative z-10 animate-fade-in-right w-full">
                        <div className="absolute -inset-4 bg-gradient-to-r from-brand-accent/20 to-purple-500/20 blur-2xl rounded-3xl -z-10 opacity-50"></div>
                        <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/20 aspect-video bg-black transform rotate-1 hover:rotate-0 transition-transform duration-500">
                            <iframe
                                width="100%"
                                height="100%"
                                src="https://www.youtube.com/embed/rX8s4JyIRBI?autoplay=1&mute=1&loop=1&playlist=rX8s4JyIRBI&controls=0&rel=0&modestbranding=1"
                                title="SonificA.R.T. Demo"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="w-full h-full object-cover pointer-events-none"
                            ></iframe>
                        </div>
                        {/* Overlay 'Click to Watch' if needed, or leave as ambient */}
                    </div>
                </div>
            </div>

            {/* SHOWCASE PREVIEW SECTION */}
            <div className="w-full bg-[#0f172a]/50 py-20 border-y border-white/5 relative z-20 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
                        <div>
                            <h2 className="text-3xl font-display font-bold text-white mb-2">Vetrina Opere</h2>
                            <p className="text-gray-400">Esplora le ultime sonificazioni create dalla community.</p>
                        </div>
                        <button onClick={onExplore} className="text-brand-accent font-bold hover:text-white transition-colors flex items-center gap-2 group">
                            Vedi tutte le opere <i className="fas fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                        {displayProjects.map((p: any) => (
                            <div key={p.id} onClick={() => onSelectProject(p.id)} className="group relative aspect-square bg-black rounded-xl overflow-hidden cursor-pointer border border-white/10 hover:border-brand-accent/50 hover:shadow-xl transition-all">
                                <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-700" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent p-4 flex flex-col justify-end">
                                    <span className="text-[10px] text-brand-accent font-bold uppercase mb-1 tracking-wider">{p.paradigm}</span>
                                    <h3 className="text-white font-bold text-lg leading-tight truncate group-hover:text-brand-accent transition-colors">{p.title}</h3>
                                    <p className="text-xs text-gray-400 mt-1">{p.author}</p>
                                </div>
                                <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <i className="fas fa-play text-xs text-white"></i>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* FEATURES GRID */}
            <div className="w-full max-w-7xl mx-auto px-6 py-24 relative z-20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <FeatureCard icon="fa-microscope" title={t('landing.features.color')} desc={t('landing.features.color_desc')} color="teal" onClick={() => onOpenDocs('doc-colorimetry')} />
                    <FeatureCard icon="fa-globe-americas" title={t('landing.features.culture')} desc={t('landing.features.culture_desc')} color="purple" onClick={() => onOpenDocs('doc-database')} />
                    <FeatureCard icon="fa-fingerprint" title={t('landing.features.deter')} desc={t('landing.features.deter_desc')} color="blue" onClick={() => onOpenDocs('doc-determinism')} />
                </div>
            </div>

            {/* PRICING (ORA COMPLETAMENTE TRADOTTO) */}
            <div className="w-full bg-gradient-to-b from-transparent to-black/40 py-24 border-t border-white/5">
                <div className="w-full max-w-7xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-4">{t('landing.pricing.title')}</h2>
                        <p className="text-brand-text-secondary mb-6">{t('landing.pricing.subtitle')}</p>

                        <div className="inline-flex bg-white/10 p-1 rounded-full border border-white/10">
                            <button onClick={() => setBillingCycle('Mensile')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${billingCycle === 'Mensile' ? 'bg-brand-accent text-brand-primary shadow-lg' : 'text-white hover:text-white/80'}`}>{t('landing.pricing.monthly')}</button>
                            <button onClick={() => setBillingCycle('Annuale')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${billingCycle === 'Annuale' ? 'bg-brand-accent text-brand-primary shadow-lg' : 'text-white hover:text-white/80'}`}>{t('landing.pricing.annual')} (-20%)</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                        {/* GRATIS */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 flex flex-col hover:border-white/20 transition-colors">
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-white">{t('landing.pricing.free.title')}</h3>
                                <div className="text-3xl font-black text-white mt-2">{t('landing.pricing.free.price')}</div>
                                <p className="text-xs text-brand-text-secondary mt-1">{t('landing.pricing.free.desc')}</p>
                            </div>
                            <ul className="space-y-4 text-sm text-brand-text-secondary flex-grow mb-8">
                                <li className="flex gap-3"><i className="fas fa-check text-green-400"></i> <span>{t('landing.pricing.free.f1')}</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-green-400"></i> <span>{t('landing.pricing.free.f2')}</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-green-400"></i> <span>{t('landing.pricing.free.f3')}</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-green-400"></i> <span>{t('landing.pricing.free.f4')}</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-green-400"></i> <span>{t('landing.pricing.free.f5')}</span></li>
                            </ul>
                            <button onClick={onGetStarted} className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors">{t('landing.pricing.free.btn')}</button>
                        </div>

                        {/* PRO */}
                        <div className="bg-brand-secondary/80 backdrop-blur-xl border border-brand-accent/50 rounded-2xl p-8 flex flex-col relative sm:transform sm:scale-105 shadow-2xl shadow-brand-accent/10 z-10">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand-accent text-brand-primary text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wide shadow-lg">{t('landing.pricing.recommended')}</div>
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-white text-brand-accent">{t('landing.pricing.pro.title')}</h3>
                                <div className="text-3xl font-black text-white mt-2">
                                    {billingCycle === 'Mensile' ? t('landing.pricing.pro.price_monthly') : t('landing.pricing.pro.price_annual')}
                                    <span className="text-sm font-normal text-gray-400"> / {billingCycle === 'Mensile' ? t('landing.pricing.month') : t('landing.pricing.year')}</span>
                                </div>
                                <p className="text-xs text-brand-text-secondary mt-1">{t('landing.pricing.pro.desc')}</p>
                            </div>
                            <ul className="space-y-4 text-sm text-white/90 flex-grow mb-8">
                                <li className="flex gap-3"><i className="fas fa-infinity text-brand-accent"></i> <span>{t('landing.pricing.pro.f1')}</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-brand-accent"></i> <span>{t('landing.pricing.pro.f2')}</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-brand-accent"></i> <span>{t('landing.pricing.pro.f3')}</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-brand-accent"></i> <span>{t('landing.pricing.pro.f4')}</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-brand-accent"></i> <span>{t('landing.pricing.pro.f5')}</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-brand-accent"></i> <span>{t('landing.pricing.pro.f6')}</span></li>
                            </ul>
                            <button onClick={() => onOpenPricing(billingCycle)} className="w-full py-4 bg-brand-accent hover:bg-brand-accent-light text-brand-primary font-bold rounded-xl transition-colors shadow-lg shadow-brand-accent/20">
                                {t('landing.pricing.pro.btn')}
                            </button>
                        </div>

                        {/* ENTERPRISE */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 flex flex-col hover:border-white/20 transition-colors">
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-white">{t('landing.pricing.custom.title')}</h3>
                                <div className="text-3xl font-black text-white mt-2">{t('landing.pricing.custom.subtitle')}</div>
                                <p className="text-xs text-brand-text-secondary mt-1">{t('landing.pricing.custom.desc')}</p>
                            </div>
                            <ul className="space-y-4 text-sm text-brand-text-secondary flex-grow mb-8">
                                <li className="flex gap-3"><i className="fas fa-check text-white"></i> <span>{t('landing.pricing.custom.f1')}</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-white"></i> <span>{t('landing.pricing.custom.f2')}</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-white"></i> <span>{t('landing.pricing.custom.f3')}</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-white"></i> <span>{t('landing.pricing.custom.f4')}</span></li>
                                <li className="flex gap-3"><i className="fas fa-check text-white"></i> <span>{t('landing.pricing.custom.f5')}</span></li>
                            </ul>
                            <button onClick={() => onOpenPricing('Enterprise')} className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors">{t('landing.pricing.custom.btn')}</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};