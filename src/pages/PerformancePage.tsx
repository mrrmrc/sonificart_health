import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { LivePerformanceOverlay } from '../components/LivePerformanceOverlay';
import { SonificationResult, DashboardEntry, ShowcaseProject } from '../types';

export const PerformancePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const query = new URLSearchParams(window.location.search);
    const isAdmin = query.get('admin') === 'true' || query.get('mode') === 'admin';
    const [isLoading, setIsLoading] = useState(true);
    const [performanceData, setPerformanceData] = useState<{ result: SonificationResult, audioBlob: Blob, title: string, author: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) {
            navigate('/dashboard');
            return;
        }

        const loadData = async () => {
            setIsLoading(true);
            try {
                // 1. Try to find in HISTORY (if logged in)
                let foundEntry: DashboardEntry | undefined;
                try {
                    const history = await api.getHistory(); // This might throw if not logged in
                    if (Array.isArray(history)) {
                        foundEntry = history.find(e => e.id === id);
                    }
                } catch (e) {
                    // Ignore, maybe not logged in
                }

                // 2. If not found, try SHOWCASE (Public)
                let showcaseItem: ShowcaseProject | undefined;
                if (!foundEntry) {
                    const showcase = await api.getShowcase(true); // Include all?
                    showcaseItem = showcase.find((p: ShowcaseProject) => p.id === id || p.historyId === id);
                }

                const target = foundEntry || showcaseItem;

                if (!target) {
                    throw new Error("Opera non trovata. Assicurati che il link sia corretto o che l'opera sia pubblica.");
                }

                // 3. Reconstruct Sonification Result & Fetch Audio

                // Audio URL is needed
                const audioUrl = (target as any).audioUrl;
                if (!audioUrl) throw new Error("Audio non disponibile per questa opera.");

                // Fetch Audio Blob
                const fixedAudioUrl = audioUrl.startsWith('http') ? audioUrl : `https://sonificart.com${audioUrl.startsWith('/') ? '' : '/'}${audioUrl}`;
                const audioRes = await fetch(fixedAudioUrl);
                if (!audioRes.ok) throw new Error("Impossibile caricare l'audio.");
                const audioBlob = await audioRes.blob();

                // Mock Result (sufficient for Overlay)
                // Note: We need blockData. Usually in History it's there. In Showcase... maybe NOT?
                // ShowcaseProject typings usually don't have blockData.
                // IF it's a showcase item without blockData, we can't run the overlay accurately.
                // However, users usually want to share their own stuff.
                // If the user wants to share a PUBLIC link, the showcase item MUST have data.
                // Check if Backend sends extended data for showcase details.
                // Assuming DashboardEntry structure for now as primary use case.

                const blockData = (target as any).blockData || { gridSize: 32, blocks: [] };

                // Helper to decompress events if they exist
                let events: any[] = [];
                if ((target as any).events) {
                    const rawEvents = (target as any).events;
                    events = rawEvents.map((e: any) => ({
                        time: e[0], duration: e[1], midiFloat: e[2], velocity: e[3],
                        sourceBlock: { r: 0, g: 0, b: 0, position: { x: e[4], y: e[5] } },
                        noteName: e[6] || "N/A"
                    }));
                }

                const result: SonificationResult = {
                    imageHash: target.id,
                    audioHash: target.id,
                    standardizedImageUrl: (target as any).imageUrl.startsWith('http') ? (target as any).imageUrl : `https://sonificart.com${(target as any).imageUrl}`,
                    paradigm: (target as any).paradigm as any,
                    blockAnalysisResult: blockData,
                    culturalSelectionResult: {
                        tradition: { name: (target as any).traditionName || (target as any).tradition || "Unknown", cultural_family: "Neutral" } as any,
                        scoreBreakdown: { total: 0 } as any
                    },
                    audioOutput: {
                        events: events,
                        eventsCount: events.length,
                        duration: 0, bpm: 0, audioUrl: fixedAudioUrl, audioWavBlob: audioBlob, midiBlob: new Blob()
                    },
                    scanPattern: { name: "Default" } as any,
                    configUsed: (target as any).configUsed || {},
                    sacContainer: {} as any,
                    validationResult: {} as any,
                    performanceMetrics: {} as any,
                    validationHashes: {} as any
                };

                setPerformanceData({
                    result,
                    audioBlob,
                    title: target.title || "Opera",
                    author: (target as any).author || "Utente"
                });

            } catch (err: any) {
                console.error(err);
                setError(err.message || "Errore sconosciuto");
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [id, navigate]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white space-y-4">
                <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="font-display tracking-widest text-sm animate-pulse">CARICAMENTO ESPERIENZA...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-6 text-center">
                <h2 className="text-3xl font-bold text-red-500 mb-4">Errore</h2>
                <p className="text-gray-300 mb-8">{error}</p>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full font-bold transition-all"
                >
                    Torna alla Dashboard
                </button>
            </div>
        );
    }

    if (!performanceData) return null;

    return (
        <LivePerformanceOverlay
            result={performanceData.result}
            audioBlob={performanceData.audioBlob}
            title={performanceData.title}
            author={performanceData.author}
            onClose={() => navigate('/dashboard')}
            mode="fullscreen"
            isAdmin={isAdmin}
            id={id} // Pass the ID for saving config
        />
    );
};
