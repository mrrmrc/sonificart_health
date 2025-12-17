
// src/pages/ProfilePage.tsx
import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { PublicProfile } from '../components/PublicProfile';
import { User } from '../types';

interface OutletContextType {
    user: User | null;
}

export const ProfilePage: React.FC = () => {
    const { user } = useOutletContext<OutletContextType>();

    if (!user) return <div className="text-center text-white pt-20">Utente non loggato.</div>;

    return <PublicProfile user={user} />;
};
