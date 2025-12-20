
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { ShowcaseProject, User } from '../types';
import { AudioPlayer } from '../components/AudioPlayer';
import { Logo } from '../components/Logo';

const fixImage = (url: string | undefined) => {
    if (!url) return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    return `https://sonificart.com${url.startsWith('/') ? '' : '/'}${url}`;
};

export const MuseumPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const projectId = searchParams.get('id') || searchParams.get('gallery_id');
    const [project, setProject] = useState<ShowcaseProject | null>(null);
    const [owner, setOwner] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const audioRef = React.useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (!projectId) {
            navigate('/');
            return;
        }

        const loadData = async () => {
            setIsLoading(true);
            try {
                const projects = await api.getShowcase();
                const target = projects.find((p: ShowcaseProject) => p.id === projectId || p.historyId === projectId);
                if (target) {
                    setProject(target);
                    // Se l'owner è un utente "custom", carichiamo i suoi dati per il logo
                    if (target.ownerId) {
                        try {
                            const userData = await api.getUserInfo(target.ownerId);
                            setOwner(userData as User);
                        } catch {
                            // Fallback se l'utente non viene trovato
                        }
                    }
                } else {
                    navigate('/showcase');
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [projectId, navigate]);

    if (isLoading) return <div className="min-h-screen bg-black flex items-center justify-center text-white font-display">Caricamento opera...</div>;
    if (!project) return null;

    // Se l'utente è custom e ha un logo, lo usiamo, altrimenti logo sonificart
    const displayLogo = (owner?.tier === 'custom' && owner.customLogoUrl) ? (
        <img src={fixImage(owner.customLogoUrl)} alt="Partner Logo" className="h-12 w-auto object-contain" />
    ) : (
        <div className="flex items-center gap-2 opacity-50 grayscale hover:grayscale-0 transition-all">
            <Logo className="w-8 h-8" />
            <span className="font-display font-bold text-white text-lg tracking-tight">Sonific<span className="text-brand-accent">A.R.T.</span></span>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black text-white flex flex-col overflow-hidden animate-fade-in font-sans">

            {/* Background Blur Artwork */}
            <div className="absolute inset-0 z-0">
                <img src={fixImage(project.imageUrl)} alt="" className="w-full h-full object-cover opacity-20 blur-3xl scale-110" />
            </div>

            {/* Header / Logo replacement */}
            <div className="relative z-20 p-6 flex justify-center">
                {displayLogo}
            </div>

            {/* Main Content */}
            <div className="relative z-10 flex-grow flex flex-col items-center justify-center p-6 space-y-8">

                {/* Artwork Frame */}
                <div className="w-full max-w-sm aspect-square rounded-2xl shadow-2xl overflow-hidden border border-white/20 transform hover:scale-[1.02] transition-transform duration-700">
                    <img src={fixImage(project.imageUrl)} alt={project.title} className="w-full h-full object-cover" />
                </div>

                {/* Info */}
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-bold tracking-tight">{project.title}</h1>
                    <p className="text-brand-accent font-display text-sm uppercase tracking-widest">{project.paradigm}</p>
                    <p className="text-gray-400 text-xs italic">Sonificazione a cura di {project.author}</p>
                </div>

                {/* Player */}
                <div className="w-full max-w-md bg-white/5 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-xl">
                    <AudioPlayer
                        audioUrl={project.audioUrl || ""}
                        audioRef={audioRef}
                    />
                </div>
            </div>

            {/* Footer / Exit */}
            <div className="relative z-10 p-8 text-center">
                <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-light">Esperienza Immersiva Framework Sonifico</p>
            </div>
        </div>
    );
};
