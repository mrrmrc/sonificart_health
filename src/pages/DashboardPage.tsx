// src/pages/DashboardPage.tsx
import React, { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { UserDashboard } from '../components/UserDashboard';
import { User, DashboardEntry } from '../types';
import { api } from '../services/api';

interface OutletContextType {
    user: User | null;
}

export const DashboardPage: React.FC = () => {
    const { user } = useOutletContext<OutletContextType>();
    const navigate = useNavigate();
    const [isLoadingFull, setIsLoadingFull] = useState(false);

    const handleLoadEntry = async (entry: DashboardEntry) => {
        // Se mancano i dati pesanti (events o config), carichiamo l'entry completa
        if (!entry.events || !entry.configUsed || !entry.blockData) {
            setIsLoadingFull(true);
            try {
                const fullEntry = await api.getHistoryItem(entry.id);
                navigate('/sonification', { state: { historyEntry: fullEntry } });
            } catch (e) {
                console.error("Errore nel caricamento completo dell'opera:", e);
                // Fallback all'entry parziale se il server fallisce
                navigate('/sonification', { state: { historyEntry: entry } });
            } finally {
                setIsLoadingFull(false);
            }
        } else {
            navigate('/sonification', { state: { historyEntry: entry } });
        }
    };

    if (!user) return <div className="text-center text-white pt-20">Effettua il login per vedere la Dashboard.</div>;

    return (
        <>
            {isLoadingFull && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-white font-bold animate-pulse">Caricamento Analisi Completa...</p>
                </div>
            )}
            <UserDashboard user={user} onLoadEntry={handleLoadEntry} />
        </>
    );
};
