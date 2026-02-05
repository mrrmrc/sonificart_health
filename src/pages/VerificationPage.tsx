
// src/pages/VerificationPage.tsx
import React, { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { VerificationPortal } from '../components/VerificationPortal';
import VerificationTool from '../components/VerificationTool';
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
    const [activeTab, setActiveTab] = useState<'sac' | 'forensic'>('sac');

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

    return (
        <div className="max-w-5xl mx-auto py-8 px-4 animate-fade-in">
            {/* TAB HEADER */}
            <div className="flex justify-center gap-4 mb-8">
                <button
                    onClick={() => setActiveTab('sac')}
                    className={`px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all ${activeTab === 'sac'
                            ? 'bg-brand-accent text-brand-primary shadow-lg shadow-brand-accent/30'
                            : 'bg-white/5 text-brand-text-secondary hover:bg-white/10 border border-white/10'
                        }`}
                >
                    <i className="fas fa-box-open mr-2"></i>
                    Verifica SAC
                </button>
                <button
                    onClick={() => setActiveTab('forensic')}
                    className={`px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all ${activeTab === 'forensic'
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30'
                            : 'bg-white/5 text-brand-text-secondary hover:bg-white/10 border border-white/10'
                        }`}
                >
                    <i className="fas fa-shield-alt mr-2"></i>
                    Verifica Forense
                    <span className="ml-2 text-[9px] bg-white/20 px-2 py-0.5 rounded uppercase">Nuovo</span>
                </button>
            </div>

            {/* TAB CONTENT */}
            {activeTab === 'sac' && (
                <VerificationPortal
                    user={user}
                    onLogin={() => setIsLoginModalOpen(true)}
                    onLoadSacProject={handleLoadSacProject}
                />
            )}

            {activeTab === 'forensic' && (
                <div className="bg-[#0a0a0c] rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-6 py-4 border-b border-white/10">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <i className="fas fa-fingerprint text-purple-400"></i>
                            Certificazione dell'Originale
                        </h3>
                        <p className="text-sm text-gray-400 mt-1">
                            Confronta un file con quello certificato all'interno di un pacchetto .sonificart
                        </p>
                    </div>
                    <VerificationTool />
                </div>
            )}
        </div>
    );
};
