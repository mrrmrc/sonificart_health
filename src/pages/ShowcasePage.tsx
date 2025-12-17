
// src/pages/ShowcasePage.tsx
import React, { useEffect, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { ShowcaseView } from '../components/ShowcaseView';
import { User } from '../types';

interface OutletContextType {
    user: User | null;
}

export const ShowcasePage: React.FC = () => {
    const { user } = useOutletContext<OutletContextType>();
    const [searchParams] = useSearchParams();
    const galleryId = searchParams.get('gallery_id') || undefined;

    // ShowcaseView gestirà internamente il galleryId
    return <ShowcaseView user={user} initialProjectId={galleryId} />;
};
