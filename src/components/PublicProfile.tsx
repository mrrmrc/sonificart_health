
import React, { useState, useEffect } from 'react';
import { User, ShowcaseProject } from '../types';
import { api } from '../services/api';

// Reusing ProjectModal logic for consistency (Internal component)
const ProjectModal: React.FC<{ project: ShowcaseProject; onClose: () => void }> = ({ project, onClose }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-backdrop-fade-in p-4" onClick={onClose}>
            <div className="relative w-full max-w-5xl bg-brand-secondary rounded-xl shadow-2xl border border-brand-secondary/50 animate-zoom-in overflow-hidden flex flex-col md:flex-row max-h-[90vh]" onClick={e => e.stopPropagation()}>
                
                <button className="absolute top-4 right-4 text-white/50 hover:text-white z-10 text-2xl" onClick={onClose}>&times;</button>

                {/* Image Side */}
                <div className="w-full md:w-3/5 bg-black flex items-center justify-center relative">
                    <img src={project.imageUrl} alt={project.title} className="max-w-full max-h-[50vh] md:max-h-full object-contain" />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                        <h2 className="text-3xl font-bold text-white mb-2">{project.title}</h2>
                        <p className="text-brand-text-secondary">by {project.author} · {project.date}</p>
                    </div>
                </div>

                {/* Content Side */}
                <div className="w-full md:w-2/5 p-8 overflow-y-auto bg-brand-secondary">
                    <div className="mb-6">
                        <h3 className="text-brand-accent font-bold uppercase tracking-widest text-xs mb-2">Descrizione del Progetto</h3>
                        <p className="text-brand-text-primary leading-relaxed">
                            {project.description}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-brand-primary/50 p-4 rounded-lg border border-brand-secondary/50">
                            <div className="text-xs text-brand-text-secondary uppercase">Paradigma</div>
                            <div className="text-white font-bold capitalize">{project.paradigm}</div>
                        </div>
                        <div className="bg-brand-primary/50 p-4 rounded-lg border border-brand-secondary/50">
                            <div className="text-xs text-brand-text-secondary uppercase">Tradizione</div>
                            <div className="text-white font-bold truncate" title={project.tradition}>{project.tradition}</div>
                        </div>
                        <div className="bg-brand-primary/50 p-4 rounded-lg border border-brand-secondary/50">
                            <div className="text-xs text-brand-text-secondary uppercase">Durata</div>
                            <div className="text-white font-mono">{project.stats.duration}</div>
                        </div>
                        <div className="bg-brand-primary/50 p-4 rounded-lg border border-brand-secondary/50">
                            <div className="text-xs text-brand-text-secondary uppercase">Note Generate</div>
                            <div className="text-white font-mono">{project.stats.notes}</div>
                        </div>
                    </div>

                    <div className="bg-brand-accent/10 border border-brand-accent/30 p-6 rounded-lg text-center mb-6">
                        <i className="fas fa-play-circle text-4xl text-brand-accent mb-3"></i>
                        <p className="text-sm text-brand-text-primary mb-4">
                            Ascolta l'estratto audio generato dal container SAC.
                        </p>
                        {/* Placeholder for audio player since we don't have real files in this demo */}
                        <div className="w-full bg-brand-secondary h-1 rounded-full overflow-hidden mb-2">
                             <div className="w-1/3 h-full bg-brand-accent"></div>
                        </div>
                        <div className="flex justify-between text-[10px] text-brand-text-secondary font-mono">
                            <span>0:00</span>
                            <span>{project.stats.duration}</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {project.tags.map(tag => (
                            <span key={tag} className="text-xs bg-brand-primary px-3 py-1 rounded-full text-brand-text-secondary border border-brand-secondary">
                                #{tag}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

interface PublicProfileProps {
    user: User | null;
}

export const PublicProfile: React.FC<PublicProfileProps> = ({ user }) => {
    const [projects, setProjects] = useState<ShowcaseProject[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedProject, setSelectedProject] = useState<ShowcaseProject | null>(null);

    useEffect(() => {
        const loadProfileData = async () => {
            if (!user) return;
            setIsLoading(true);
            try {
                // In a real scenario, filter by user ID via API
                // For now, we fetch all and filter locally or use mock logic
                const allProjects = await api.getShowcase();
                // Filter projects that "belong" to this user (simulated by checking author name or ID)
                const userProjects = allProjects.filter(p => p.author === user.name || p.ownerId === user.id);
                setProjects(userProjects);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        loadProfileData();
    }, [user]);

    if (!user) return <div className="text-center p-10 text-brand-text-secondary">Utente non trovato.</div>;

    return (
        <div className="max-w-6xl mx-auto animate-fade-in pb-16">
            
            {/* Profile Header */}
            <div className="relative bg-brand-secondary/50 rounded-xl p-8 mb-12 border border-brand-secondary flex flex-col md:flex-row items-center gap-8">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 p-1 shadow-2xl">
                     <div className="w-full h-full rounded-full bg-brand-primary flex items-center justify-center overflow-hidden">
                         {user.avatarUrl ? (
                             <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                         ) : (
                             <span className="text-4xl font-bold text-white">{user.name?.substring(0,2).toUpperCase() || 'UT'}</span>
                         )}
                     </div>
                </div>
                
                <div className="text-center md:text-left flex-grow">
                    <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                        <h1 className="text-3xl font-bold text-white">{user.name}</h1>
                        {user.isPro && <span className="bg-brand-accent/20 text-brand-accent text-xs font-bold px-2 py-1 rounded border border-brand-accent/30">PRO ARTIST</span>}
                    </div>
                    <p className="text-brand-text-secondary max-w-2xl">
                        {/* Mock Bio */}
                        Esploratore sonoro e artista visivo. Utilizzo SonificA.R.T. per tradurre le mie fotografie di viaggio in paesaggi sonori immersivi.
                    </p>
                    
                    <div className="flex gap-4 mt-4 justify-center md:justify-start">
                         <div className="text-center">
                             <span className="block text-xl font-bold text-white">{projects.length}</span>
                             <span className="text-xs text-brand-text-secondary uppercase">Opere</span>
                         </div>
                         <div className="text-center">
                             <span className="block text-xl font-bold text-white">0</span>
                             <span className="text-xs text-brand-text-secondary uppercase">Follower</span>
                         </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button className="bg-brand-primary hover:bg-brand-secondary border border-brand-secondary text-white px-4 py-2 rounded-md transition-colors">
                        <i className="fas fa-share-alt mr-2"></i> Condividi
                    </button>
                </div>
            </div>

            {/* Portfolio Grid */}
            <h2 className="text-2xl font-bold text-white mb-6 border-b border-brand-secondary pb-4">Portfolio Opere</h2>
            
            {isLoading ? (
                <div className="text-center py-10"><i className="fas fa-circle-notch fa-spin text-brand-accent"></i> Caricamento...</div>
            ) : projects.length === 0 ? (
                <div className="text-center py-16 bg-brand-secondary/20 rounded-lg border border-dashed border-brand-secondary/50">
                    <i className="fas fa-folder-open text-4xl text-brand-text-secondary mb-4"></i>
                    <p className="text-brand-text-secondary">Nessuna opera pubblica.</p>
                    <p className="text-xs text-brand-text-secondary mt-2">Vai nella Dashboard per pubblicare le tue sonificazioni.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map(project => (
                        <div 
                            key={project.id} 
                            onClick={() => setSelectedProject(project)}
                            className="group bg-brand-secondary/30 rounded-lg overflow-hidden border border-brand-secondary hover:border-brand-accent/50 transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1"
                        >
                            <div className="aspect-video relative overflow-hidden">
                                <img src={project.imageUrl} alt={project.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                <div className="absolute bottom-2 left-2">
                                    <span className="bg-black/60 backdrop-blur-md text-white text-xs px-2 py-1 rounded">
                                        {project.paradigm}
                                    </span>
                                </div>
                            </div>
                            <div className="p-4">
                                <h3 className="font-bold text-white mb-1 truncate group-hover:text-brand-accent transition-colors">{project.title}</h3>
                                <p className="text-xs text-brand-text-secondary mb-3 line-clamp-2">{project.description}</p>
                                <div className="flex justify-between text-xs text-brand-text-secondary border-t border-brand-secondary/50 pt-2">
                                    <span>{project.stats.duration}</span>
                                    <span>{project.date}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedProject && (
                <ProjectModal project={selectedProject} onClose={() => setSelectedProject(null)} />
            )}

        </div>
    );
};
