
// src/pages/AdminPage.tsx
import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { AdminPanel } from '../components/AdminPanel';
import { User } from '../types';

interface OutletContextType {
    user: User | null;
}

export const AdminPage: React.FC = () => {
    const { user } = useOutletContext<OutletContextType>();

    if (!user || !user.isAdmin) return <div className="text-center text-white pt-20">Accesso Negato.</div>;

    return <AdminPanel />;
};
