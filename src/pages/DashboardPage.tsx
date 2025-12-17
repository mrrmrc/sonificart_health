
// src/pages/DashboardPage.tsx
import React from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { UserDashboard } from '../components/UserDashboard';
import { User, DashboardEntry } from '../types';

interface OutletContextType {
    user: User | null;
}

export const DashboardPage: React.FC = () => {
    const { user } = useOutletContext<OutletContextType>();
    const navigate = useNavigate();

    const handleLoadEntry = (entry: DashboardEntry) => {
        // Naviga alla pagina di sonificazione passando l'entry nello stato
        navigate('/sonification', { state: { historyEntry: entry } });
    };

    if (!user) return <div className="text-center text-white pt-20">Effettua il login per vedere la Dashboard.</div>;

    return <UserDashboard onLoadEntry={handleLoadEntry} />;
};
