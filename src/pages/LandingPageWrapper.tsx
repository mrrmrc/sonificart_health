
// src/pages/LandingPageWrapper.tsx
import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { LandingPage } from '../components/LandingPage';
import { User, ShowcaseProject } from '../types';
import { api } from '../services/api';

import { ProjectModal } from '../components/ProjectModal';

interface OutletContextType {
    user: User | null;
    setIsLoginModalOpen: (open: boolean) => void;
    setIsRequestAccessOpen: (open: boolean) => void;
    openRequestAccess: (plan: string) => void;
    setHelpInitialSection: (s: string | undefined) => void;
    setIsHelpModalOpen: (o: boolean) => void;
}

export const LandingPageWrapper: React.FC = () => {
    const { user, setIsLoginModalOpen, openRequestAccess, setHelpInitialSection, setIsHelpModalOpen } = useOutletContext<OutletContextType>();
    const navigate = useNavigate();
    const [latestProjects, setLatestProjects] = useState<ShowcaseProject[]>([]);
    const [selectedProject, setSelectedProject] = useState<ShowcaseProject | null>(null);

    useEffect(() => {
        const queryParams = new URLSearchParams(window.location.search);
        const galleryId = queryParams.get('gallery_id') || queryParams.get('id');
        if (galleryId) {
            navigate(`/showcase?id=${galleryId}`, { replace: true });
        }
    }, [navigate]);

    const loadProjects = async () => {
        try {
            const data = await api.getShowcase();
            if (Array.isArray(data)) setLatestProjects(data.slice(0, 4));
        } catch (e) { console.error("Failed to load showcase preview", e); }
    };

    useEffect(() => {
        loadProjects();
    }, []);

    const handleProjectUpdate = async (p: ShowcaseProject) => {
        try {
            await api.updateShowcaseItem(p);
            setSelectedProject(p);
            loadProjects(); // Ricarica per vedere modifiche (es. invisibile)
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <>
            <LandingPage
                onGetStarted={() => { if (user) navigate('/sonification'); else setIsLoginModalOpen(true); }}
                onExplore={() => navigate('/showcase')}
                onOpenPricing={(plan) => openRequestAccess(plan || 'Mensile')}
                onOpenDocs={(section) => { setHelpInitialSection(section); setIsHelpModalOpen(true); }}
                latestProjects={latestProjects}
                onSelectProject={(id) => {
                    const project = latestProjects.find(p => p.id === id);
                    if (project) setSelectedProject(project);
                }}
            />
            {selectedProject && (
                <ProjectModal
                    project={selectedProject}
                    onClose={() => setSelectedProject(null)}
                    user={user}
                    onUpdate={handleProjectUpdate}
                />
            )}
        </>
    );
};
