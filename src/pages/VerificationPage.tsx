
// src/pages/VerificationPage.tsx
import React from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { VerificationPortal } from '../components/VerificationPortal';
import { User, SacVerificationResult } from '../types';
import { reconstructResultFromPartialData } from '../utils/dataUtils';
import JSZip from 'jszip';

interface OutletContextType {
    user: User | null;
    setIsLoginModalOpen: (open: boolean) => void;
}

export const VerificationPage: React.FC = () => {
    const { user, setIsLoginModalOpen } = useOutletContext<OutletContextType>();
    const navigate = useNavigate();

    const handleLoadSacProject = async (file: File, verificationResult: SacVerificationResult) => {
        try {
            const zip = await JSZip.loadAsync(file);
            const jsonFile = zip.file("sonification_data.json");
            if (!jsonFile) throw new Error("JSON mancante");
            const jsonData = JSON.parse(await jsonFile.async("string"));

            let imgUrl = "";
            const imgFile = zip.file("original_image.jpg") || zip.file("original_image.png");
            if (imgFile) imgUrl = URL.createObjectURL(await imgFile.async("blob"));

            let audioUrl = ""; let audioBlob = new Blob([], { type: 'audio/wav' });
            let audioFile = zip.file("generated_audio.wav");
            if (!audioFile) { const wavFiles = Object.keys(zip.files).filter(f => f.endsWith('.wav')); if (wavFiles.length > 0) audioFile = zip.file(wavFiles[0]); }
            if (audioFile) {
                const buffer = await audioFile.async("arraybuffer");
                audioBlob = new Blob([buffer], { type: 'audio/wav' });
                audioUrl = URL.createObjectURL(audioBlob);
            }

            const restoredResult = reconstructResultFromPartialData(
                jsonData,
                imgUrl || jsonData.standardizedImageUrl,
                audioUrl,
                file.name,
                verificationResult.extractedVideoBlob
            );
            restoredResult.audioOutput.audioWavBlob = audioBlob;

            navigate('/sonification', { state: { sacResult: restoredResult } });

        } catch (e) {
            console.error("Errore Caricamento SAC:", e);
            alert("Errore critico durante la lettura del file.");
        }
    };

    return <VerificationPortal user={user} onLogin={() => setIsLoginModalOpen(true)} onLoadSacProject={handleLoadSacProject} />;
};
