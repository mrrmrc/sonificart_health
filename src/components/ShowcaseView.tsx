import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ShowcaseProject, User } from '../types';
import { api } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { ConfirmationModal } from './ConfirmationModal';
import { ProjectModal } from './ProjectModal';

const fixImage = (url: string | undefined) => {
    if (!url) return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    return `data:image/jpeg;base64,${url}`;
};



interface ShowcaseViewProps {
    user?: User | null;
    initialProjectId?: string;
    museumMode?: boolean;
}

export const ShowcaseView: React.FC<ShowcaseViewProps> = ({ user, initialProjectId, museumMode }) => {
    const { t } = useLanguage();
    const [projects, setProjects] = useState<ShowcaseProject[]>([]);
    const [selectedProject, setSelectedProject] = useState<ShowcaseProject | null>(null);
    const [filter, setFilter] = useState('all');
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'az'>('newest');
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, type: 'info' | 'warning' | 'danger' | 'success', singleButton?: boolean }>({ isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'info' });

    const ITEMS_PER_PAGE = 12;

    const fetchShowcase = async () => {
        setIsLoading(true);
        try {
            // FIX: Cache busting per vedere subito le modifiche
            const timestamp = new Date().getTime();
            const data = await api.getShowcase(user?.isAdmin || false);
            setProjects(data);

            if (initialProjectId) {
                // Supporta sia l'ID Vetrina che l'ID Storia (QR Code)
                const target = data.find((p: ShowcaseProject) => p.id === initialProjectId || p.historyId === initialProjectId);
                if (target) setSelectedProject(target);
            }
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchShowcase(); }, [initialProjectId]);

    const filteredAndSortedProjects = useMemo(() => {
        let result = projects.filter(p => p.isFeatured);
        if (filter !== 'all') result = result.filter(p => p.paradigm === filter);
        result.sort((a, b) => {
            if (sortOrder === 'newest') return new Date(b.date).getTime() - new Date(a.date).getTime();
            if (sortOrder === 'oldest') return new Date(a.date).getTime() - new Date(b.date).getTime();
            return a.title.localeCompare(b.title);
        });
        return result;
    }, [projects, filter, sortOrder]);

    const paginatedProjects = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredAndSortedProjects.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredAndSortedProjects, currentPage]);

    const totalPages = Math.ceil(filteredAndSortedProjects.length / ITEMS_PER_PAGE);

    const handleDeleteItem = async (id: string) => {
        // 1. Update UI immediately (Optimistic)
        setProjects(prev => prev.filter(p => p.id !== id));
        setSelectedProject(null);

        // 2. Call API
        try {
            await api.deleteShowcaseItem(id);
        } catch (e) {
            setConfirmModal({
                isOpen: true,
                title: "Errore",
                message: t('showcase.error_delete'),
                type: 'danger',
                singleButton: true,
                onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            });
            fetchShowcase(); // Revert if failed
        }
    };

    const handleUpdateItem = (updatedProject: ShowcaseProject) => {
        setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
        setSelectedProject(updatedProject);
    };

    if (isLoading) return <div className="text-center py-20 text-gray-500">{t('showcase.loading')}</div>;

    return (
        <div className="w-full max-w-7xl mx-auto animate-fade-in pb-20">
            <div className="text-center mb-12">
                <h2 className="text-4xl font-display font-bold text-white mb-4">{t('showcase.title')}</h2>
                <p className="text-brand-text-secondary mb-8">{t('showcase.subtitle')}</p>
                <div className="flex flex-wrap justify-center gap-4 bg-white/5 p-2 rounded-full inline-flex backdrop-blur-sm border border-white/10">
                    {['all', 'scientific', 'artistic', 'hybrid'].map(f => (
                        <button key={f} onClick={() => { setFilter(f); setCurrentPage(1); }} className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-colors ${filter === f ? 'bg-brand-accent text-brand-primary' : 'text-gray-400 hover:text-white'}`}>{t(`showcase.${f === 'all' ? 'all' : f}`)}</button>
                    ))}
                    <div className="w-px h-6 bg-white/10 mx-2 self-center hidden sm:block"></div>
                    <select aria-label={t('showcase.sort')} value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)} className="bg-transparent text-xs font-bold text-gray-300 focus:outline-none cursor-pointer appearance-none py-1 px-2">
                        <option value="newest" className="bg-[#0f172a]">{t('showcase.newest')}</option>
                        <option value="oldest" className="bg-[#0f172a]">{t('showcase.oldest')}</option>
                        <option value="az" className="bg-[#0f172a]">A-Z</option>
                    </select>
                </div>
            </div>

            {/* Disclaimer */}
            <div className="flex justify-center mt-6 mb-8 px-4">
                <div className="bg-white/5 border border-white/10 rounded-lg px-6 py-3 flex items-center gap-3 max-w-2xl text-center shadow-lg backdrop-blur-sm">
                    <i className="fas fa-info-circle text-brand-accent text-sm"></i>
                    <p className="text-xs text-gray-400 leading-relaxed">
                        Le immagini sono pubbliche e scaricabili. Il download non autorizza l’uso commerciale o la redistribuzione.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-4">
                {paginatedProjects.map(p => (
                    <div key={p.id} onClick={() => setSelectedProject(p)} className="group relative aspect-square bg-black rounded-xl overflow-hidden cursor-pointer border border-white/10 hover:border-brand-accent/50 hover:shadow-lg transition-all">
                        <img src={fixImage(p.imageUrl)} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-all duration-700" alt={p.title} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent p-4 flex flex-col justify-end">
                            <span className="text-[10px] text-brand-accent font-bold uppercase mb-1">{p.paradigm}</span>
                            <h3 className="text-white font-bold text-lg leading-tight truncate">{p.title}</h3>
                            <p className="text-xs text-gray-400">{t('showcase.by')} {p.author}</p>
                        </div>
                        {p.videoUrl && <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-md w-8 h-8 rounded-full flex items-center justify-center text-white"><i className="fas fa-video text-xs"></i></div>}
                    </div>
                ))}
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-12">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1 rounded bg-white/10 text-white disabled:opacity-30 hover:bg-white/20">&lt;</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <button key={p} onClick={() => setCurrentPage(p)} className={`w-8 h-8 rounded font-bold text-sm ${currentPage === p ? 'bg-brand-accent text-brand-primary' : 'bg-white/10 text-white hover:bg-white/20'}`}>{p}</button>
                    ))}
                    <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1 rounded bg-white/10 text-white disabled:opacity-30 hover:bg-white/20">&gt;</button>
                </div>
            )}

            {selectedProject && (
                <ProjectModal
                    project={selectedProject}
                    onClose={() => setSelectedProject(null)}
                    user={user}
                    onDelete={handleDeleteItem}
                    onUpdate={handleUpdateItem}
                    museumMode={museumMode}
                />
            )}

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
                singleButton={confirmModal.singleButton}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
};