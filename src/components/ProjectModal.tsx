import React, { useState, useEffect, useRef } from 'react';
import { ShowcaseProject, User } from '../types';
import { api } from '../services/api';
import { AudioPlayer } from './AudioPlayer';
import { generateParadigmPreview } from '../services/audioUtils';
import { useLanguage } from '../contexts/LanguageContext';
import { ConfirmationModal } from './ConfirmationModal';

const fixImage = (url: string | undefined) => {
    if (!url) return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    return `data:image/jpeg;base64,${url}`;
};

const QrZoomModal: React.FC<{ url: string; onClose: () => void }> = ({ url, onClose }) => {
    const { t } = useLanguage();
    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/90 animate-fade-in p-4" onClick={onClose}>
            <div className="bg-white p-4 rounded-xl shadow-2xl animate-zoom-in max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
                <h3 className="text-black font-bold mb-4 text-lg">{t('showcase.scan_qr')}</h3>
                <img src={url} alt="QR Full" className="w-full h-auto" />
                <button onClick={onClose} className="mt-4 bg-gray-800 text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-black transition-colors">{t('showcase.close')}</button>
            </div>
        </div>
    );
};

export interface ProjectModalProps {
    project: ShowcaseProject;
    onClose: () => void;
    user?: User | null;
    onDelete?: (id: string) => void;
    onUpdate?: (project: ShowcaseProject) => void;
    museumMode?: boolean;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({ project, onClose, user, onDelete, onUpdate, museumMode }) => {
    const { t } = useLanguage();
    const [audioUrl, setAudioUrl] = useState<string | null>(project.audioUrl || null);
    const [isGenerating, setIsGenerating] = useState(!project.audioUrl);
    const [zoomedQrUrl, setZoomedQrUrl] = useState<string | null>(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    // EDIT MODE STATES
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(project.title);
    const [editDescription, setEditDescription] = useState(project.description);
    const [isSaving, setIsSaving] = useState(false);

    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, type: 'info' | 'warning' | 'danger' | 'success', singleButton?: boolean }>({ isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'info' });

    const audioRef = useRef<HTMLAudioElement>(null);
    const hasVideo = !!project.videoUrl;
    const isOwner = user && (user.isAdmin || user.id === project.ownerId);
    const canDelete = !!onDelete && isOwner;

    const getAbsoluteUrl = (url: string | undefined) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        return `https://sonificart.com${url.startsWith('/') ? '' : '/'}${url}`;
    };

    const museumLink = `https://sonificart.com/museum?id=${project.id || project.historyId}`;
    const qrTargetUrl = museumLink;
    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrTargetUrl)}`;

    const videoShareUrl = project.videoUrl ? getAbsoluteUrl(project.videoUrl) : null;
    const qrVideoImgUrl = videoShareUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(videoShareUrl)}` : null;

    useEffect(() => {
        if (!project.audioUrl && !hasVideo) {
            setIsGenerating(true);
            generateParadigmPreview(project.paradigm as any).then(url => {
                if (url) {
                    setAudioUrl(url);
                    setIsGenerating(false);
                }
            });
        } else {
            setAudioUrl(project.audioUrl || null);
            setIsGenerating(false);
        }
    }, [project, hasVideo]);

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDeleteConfirmOpen(true);
    };

    const handleConfirmDelete = () => {
        setIsDeleteConfirmOpen(false);
        onDelete?.(project.id);
    };

    const handleSave = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsSaving(true);
        try {
            const updatedProject = { ...project, title: editTitle, description: editDescription };
            await api.updateShowcaseItem(updatedProject);
            onUpdate?.(updatedProject);
            setIsEditing(false);
        } catch (e) {
            setConfirmModal({
                isOpen: true,
                title: "Errore",
                message: t('showcase.error_save'),
                type: 'danger',
                singleButton: true,
                onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleShare = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(qrTargetUrl);
        setConfirmModal({
            isOpen: true,
            title: "Link Oper Copiato",
            message: t('showcase.link_copied'),
            type: 'success',
            singleButton: true,
            onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
        });
    };

    const handleShareVideo = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!videoShareUrl) return;
        navigator.clipboard.writeText(videoShareUrl);
        setConfirmModal({
            isOpen: true,
            title: "Link Video Copiato",
            message: "Link del video copiato negli appunti!",
            type: 'success',
            singleButton: true,
            onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
        });
    };

    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/95 ${museumMode ? '' : 'backdrop-blur-md'} animate-fade-in p-4`} onClick={museumMode ? undefined : onClose}>

            {zoomedQrUrl && <QrZoomModal url={zoomedQrUrl} onClose={() => setZoomedQrUrl(null)} />}

            <div className={`bg-[#0f172a] w-full ${museumMode ? 'max-w-4xl h-[90vh]' : 'max-w-6xl h-full md:h-[85vh]'} rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row border border-white/10 animate-zoom-in relative`} onClick={e => e.stopPropagation()}>

                {/* GLOBAL CLOSE BUTTON FOR MOBILE/DESKTOP */}
                {!museumMode && (
                    <button onClick={onClose} className="absolute top-4 right-4 z-[60] text-white/50 hover:text-white transition-colors bg-black/40 backdrop-blur-md rounded-full w-10 h-10 flex items-center justify-center border border-white/10" aria-label={t('dashboard.cancel')}>
                        <i className="fas fa-times"></i>
                    </button>
                )}

                {/* MEDIA AREA */}
                <div className={`${museumMode ? 'w-full md:w-3/5' : 'w-full md:w-2/3'} bg-black relative flex items-center justify-center h-64 sm:h-80 md:h-auto shrink-0`}>
                    {hasVideo ? (
                        <video src={fixImage(project.videoUrl)} controls autoPlay className="w-full h-full object-contain" />
                    ) : (
                        <img src={fixImage(project.imageUrl)} alt={project.title} className="w-full h-full object-contain" />
                    )}
                </div>

                {/* INFO AREA */}
                <div className={`${museumMode ? 'w-full md:w-2/5' : 'w-full md:w-1/3'} bg-[#1e1e2e] border-l border-white/10 p-8 flex flex-col overflow-y-auto relative z-10 custom-scrollbar`}>

                    <div className="mb-6 border-b border-white/10 pb-6">
                        {isEditing ? (
                            <input
                                className="w-full bg-black/30 border border-white/20 p-2 rounded text-2xl font-bold text-white mb-2 focus:border-brand-accent outline-none"
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                                onClick={e => e.stopPropagation()}
                            />
                        ) : (
                            <h1 className="text-3xl font-bold text-white mb-2 font-display leading-tight">{project.title}</h1>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-sm text-brand-text-secondary font-mono">
                            <span className="flex items-center gap-2 bg-black/30 px-2 py-1 rounded border border-white/5">
                                <i className="fas fa-user-circle"></i> {project.author}
                            </span>
                            <span className="text-gray-600">•</span>
                            <span>{new Date(project.date).toLocaleDateString()}</span>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-brand-accent uppercase tracking-widest mb-2">Descrizione</h3>
                        {isEditing ? (
                            <textarea
                                className="w-full bg-black/30 border border-white/20 p-2 rounded text-sm text-white h-32 focus:border-brand-accent outline-none resize-none"
                                value={editDescription}
                                onChange={e => setEditDescription(e.target.value)}
                                onClick={e => e.stopPropagation()}
                            />
                        ) : (
                            <p className="text-gray-300 leading-relaxed text-sm">
                                {project.description || t('showcase.no_description')}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-black/20 p-3 rounded border border-white/5">
                            <span className="text-[10px] text-gray-500 uppercase block mb-1 font-bold">{t('showcase.tradition')}</span>
                            <span className="text-sm font-bold text-white truncate">{project.tradition}</span>
                        </div>
                        <div className="bg-black/20 p-3 rounded border border-white/5">
                            <span className="text-[10px] text-gray-500 uppercase block mb-1 font-bold">{t('showcase.paradigm')}</span>
                            <span className="text-sm font-bold text-white capitalize">{project.paradigm}</span>
                        </div>
                    </div>

                    {!museumMode && (
                        <>
                            <div className="bg-white/5 p-4 rounded-xl border border-white/10 mb-4 flex items-center gap-4">
                                <div className="w-20 h-20 bg-white p-1 rounded cursor-pointer hover:scale-105 transition-transform" onClick={() => setZoomedQrUrl(qrImgUrl)}>
                                    <img src={qrImgUrl} alt="QR" className="w-full h-full" />
                                </div>
                                <div className="flex flex-col gap-2 flex-grow">
                                    <h4 className="text-xs font-bold text-white uppercase">{t('showcase.share_work')}</h4>
                                    <div className="flex gap-2">
                                        <button onClick={() => setZoomedQrUrl(qrImgUrl)} className="flex-1 py-1.5 bg-black/40 hover:bg-black/60 text-white text-[10px] font-bold rounded border border-white/10">{t('showcase.scan_qr')}</button>
                                        <button onClick={handleShare} className="flex-1 py-1.5 bg-brand-accent/20 hover:bg-brand-accent/30 text-brand-accent text-[10px] font-bold rounded border border-brand-accent/20">{t('showcase.copy_link')}</button>
                                    </div>
                                </div>
                            </div>


                        </>
                    )}

                    {/* MEDIA CENTER & ACTIONS */}
                    {!museumMode && (
                        <div className="mt-auto pt-6 border-t border-white/10">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Media Center</h3>

                            {/* AUDIO PLAYER (Sempre visibile se c'è audio e non è video full) */}
                            {(!hasVideo || museumMode) && (
                                <div className="bg-black/20 p-3 rounded-lg border border-white/5 mb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] text-gray-400 font-bold uppercase"><i className="fas fa-waveform mr-1"></i> Traccia Audio</span>
                                    </div>
                                    {audioUrl ? <AudioPlayer audioRef={audioRef} audioUrl={audioUrl} /> : <div className="h-8 bg-white/5 rounded animate-pulse"></div>}
                                </div>
                            )}

                            {/* VIDEO ACTIONS */}
                            {hasVideo && (
                                <div className="bg-purple-900/10 p-4 rounded-xl border border-purple-500/20 mb-6 group hover:border-purple-500/40 transition-colors">
                                    <h4 className="text-[10px] font-bold text-purple-300 uppercase tracking-wide mb-3 flex items-center justify-between">
                                        <span><i className="fas fa-cube mr-1"></i> Asset Sinestetico</span>
                                        <span className="bg-purple-500/20 text-purple-200 px-1.5 py-0.5 rounded text-[9px]">MP4 READY</span>
                                    </h4>

                                    {qrVideoImgUrl && (
                                        <div className="flex gap-2 mb-3">
                                            <button onClick={() => setZoomedQrUrl(qrVideoImgUrl)} className="flex-1 py-2 bg-black/40 hover:bg-black/60 text-white text-[10px] font-bold rounded border border-white/10 flex items-center justify-center gap-2">
                                                <i className="fas fa-qrcode"></i> {t('showcase.scan_qr')}
                                            </button>
                                            <button onClick={handleShareVideo} className="flex-1 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[10px] font-bold rounded border border-purple-500/20 flex items-center justify-center gap-2">
                                                <i className="fas fa-link"></i> Copia Link
                                            </button>
                                        </div>
                                    )}

                                    <a
                                        href={project.videoUrl}
                                        download={`${project.title.replace(/\s+/g, '_')}_synesthetic.mp4`}
                                        className="w-full py-3 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded flex flex-col items-center justify-center gap-1 border border-white/10 transition-all hover:border-purple-500/50"
                                    >
                                        <i className="fas fa-download text-lg mb-1 text-purple-400"></i>
                                        <span>Scarica Video</span>
                                    </a>
                                </div>
                            )}


                        </div>
                    )}

                    {user?.isAdmin && !museumMode && (
                        <div className="bg-brand-secondary/30 p-4 rounded-xl border border-brand-accent/30 shadow-inner mb-4">
                            <h4 className="text-[10px] font-bold text-brand-accent uppercase tracking-[0.2em] mb-3">Gestione Admin</h4>
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-white">Visibilità Landing</span>
                                    <button
                                        onClick={() => onUpdate?.({ ...project, isPublic: !project.isPublic })}
                                        className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${project.isPublic ? 'bg-brand-accent/20 border-brand-accent text-brand-accent' : 'bg-white/5 border-white/10 text-gray-500'}`}
                                    >
                                        {project.isPublic ? 'PUBBLICA' : 'NASCOSTA'}
                                    </button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-white">Priorità (0-99)</span>
                                    <input
                                        type="number"
                                        value={project.priority || 0}
                                        onChange={e => onUpdate?.({ ...project, priority: parseInt(e.target.value) || 0 })}
                                        className="w-16 bg-black/40 border border-white/10 rounded px-2 py-1 text-center text-xs font-bold text-brand-accent focus:border-brand-accent outline-none"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-white">In Slider</span>
                                    <button
                                        onClick={() => onUpdate?.({ ...project, isFeatured: !project.isFeatured })}
                                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${project.isFeatured ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-white/5 text-gray-600'}`}
                                    >
                                        <i className="fas fa-star text-[10px]"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {isOwner && (
                        <div className="mt-auto pt-6 border-t border-white/10">
                            <button
                                onClick={handleDeleteClick}
                                className="w-full py-3 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-lg text-xs font-bold transition-all hover:shadow-lg hover:shadow-red-900/20 flex items-center justify-center gap-2"
                            >
                                <i className="fas fa-trash"></i> {t('showcase.remove')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmationModal
                isOpen={isDeleteConfirmOpen}
                title={t('showcase.remove')}
                message={t('showcase.confirm_delete')}
                type="danger"
                onConfirm={handleConfirmDelete}
                onCancel={() => setIsDeleteConfirmOpen(false)}
            />

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
