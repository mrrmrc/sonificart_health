
// src/pages/LandingPageWrapper.tsx
import React from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { LandingPage } from '../components/LandingPage';
import { User } from '../types';

interface OutletContextType {
    user: User | null;
    setIsLoginModalOpen: (open: boolean) => void;
    setIsRequestAccessOpen: (open: boolean) => void;
    setHelpInitialSection: (s: string | undefined) => void;
    setIsHelpModalOpen: (o: boolean) => void;
}

export const LandingPageWrapper: React.FC = () => {
    const { user, setIsLoginModalOpen, setIsRequestAccessOpen, setHelpInitialSection, setIsHelpModalOpen } = useOutletContext<OutletContextType>();
    const navigate = useNavigate();

    return (
        <LandingPage
            onGetStarted={() => { if (user) navigate('/sonification'); else setIsLoginModalOpen(true); }}
            onExplore={() => navigate('/showcase')}
            onOpenPricing={() => setIsRequestAccessOpen(true)}
            onOpenDocs={(section) => { setHelpInitialSection(section); setIsHelpModalOpen(true); }}
        />
    );
};
