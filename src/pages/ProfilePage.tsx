// src/pages/ProfilePage.tsx
import React from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { PublicProfile } from '../components/PublicProfile';
import { User } from '../types';

interface OutletContextType {
    user: User | null;
}

export const ProfilePage: React.FC = () => {
    const context = useOutletContext<OutletContextType>();
    const user = context?.user || null;
    const { id } = useParams();

    // If viewing a specific artist (public link)
    if (id) {
        return <PublicProfile user={user} targetUserId={id} />;
    }

    // If viewing own private profile
    if (!user) return <div className="text-center text-white/50 pt-32 italic">Accedi per visualizzare il tuo profilo o creare la tua galleria.</div>;

    return <PublicProfile user={user} />;
};
