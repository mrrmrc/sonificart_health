import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../services/api';
import { User, DashboardEntry } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ScatterChart, Scatter, ZAxis, AreaChart, Area, CartesianGrid } from 'recharts';

interface OutletContextType {
    user: User | null;
}

const COLORS = ['#2dd4bf', '#a855f7', '#f43f5e', '#eab308'];

export const ComparePage: React.FC = () => {
    const { user } = useOutletContext<OutletContextType>();

    // State
    const [history, setHistory] = useState<DashboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [idA, setIdA] = useState<string>('');
    const [idB, setIdB] = useState<string>('');

    // Audio Sync State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [crossfade, setCrossfade] = useState(50); // 0 = A, 100 = B

    // Waveform State
    const [waveformData, setWaveformData] = useState<any[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Zoom Modal State
    const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);

    // Audio & Refs
    const audioRefA = useRef<HTMLAudioElement>(null);
    const audioRefB = useRef<HTMLAudioElement>(null);
    const requestRef = useRef<number>();

    // Preview Synth
    const audioCtxRef = useRef<AudioContext | null>(null);

    // Fetch History
    useEffect(() => {
        const loadHistory = async () => {
            try {
                const data = await api.getHistory();
                if (Array.isArray(data)) {
                    setHistory(data);
                    if (data.length >= 2) {
                        setIdA(data[0].id);
                        setIdB(data[1].id);
                    } else if (data.length === 1) {
                        setIdA(data[0].id);
                    }
                }
            } catch (e) {
                console.error("Failed to load history", e);
            } finally {
                setIsLoading(false);
            }
        };
        if (user) loadHistory();
    }, [user]);

    // Derived Selection
    const itemA = useMemo(() => history.find(h => h.id === idA), [history, idA]);
    const itemB = useMemo(() => history.find(h => h.id === idB), [history, idB]);

    // Initialize Audio Context
    useEffect(() => {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        return () => { audioCtxRef.current?.close(); };
    }, []);

    // Waveform Analysis
    useEffect(() => {
        const analyzeAudio = async () => {
            if (!itemA?.audioUrl || !itemB?.audioUrl) return;
            setIsAnalyzing(true);
            try {
                const fetchAndDecode = async (url: string) => {
                    const res = await fetch(url);
                    const buf = await res.arrayBuffer();
                    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                    return await audioCtxRef.current.decodeAudioData(buf);
                };

                const [bufferA, bufferB] = await Promise.all([
                    fetchAndDecode(itemA.audioUrl),
                    fetchAndDecode(itemB.audioUrl)
                ]);

                // Create visualization data (downsample to ~200 points)
                const samples = 200;
                const data = [];
                const chanA = bufferA.getChannelData(0);
                const chanB = bufferB.getChannelData(0);
                const stepA = Math.floor(chanA.length / samples);
                const stepB = Math.floor(chanB.length / samples);
                const maxDur = Math.max(bufferA.duration, bufferB.duration);

                for (let i = 0; i < samples; i++) {
                    let sumA = 0, sumB = 0;
                    for (let j = 0; j < stepA; j++) sumA += Math.abs(chanA[i * stepA + j] || 0);
                    for (let j = 0; j < stepB; j++) sumB += Math.abs(chanB[i * stepB + j] || 0);

                    data.push({
                        time: (i / samples) * maxDur,
                        ampA: (sumA / stepA) * 100, // Normalize roughly
                        ampB: (sumB / stepB) * 100,
                    });
                }
                setWaveformData(data);
            } catch (e) {
                console.error("Waveform analysis failed", e);
            } finally {
                setIsAnalyzing(false);
            }
        };

        analyzeAudio();
    }, [itemA, itemB]);


    // Volume Control & Sync Logic
    useEffect(() => {
        if (audioRefA.current) audioRefA.current.volume = (100 - crossfade) / 100;
        if (audioRefB.current) audioRefB.current.volume = crossfade / 100;
    }, [crossfade]);

    // Animation Loop
    const animate = () => {
        if (audioRefA.current) {
            setCurrentTime(audioRefA.current.currentTime);
            if (audioRefB.current && Math.abs(audioRefB.current.currentTime - audioRefA.current.currentTime) > 0.1) {
                audioRefB.current.currentTime = audioRefA.current.currentTime;
            }
        }
        requestRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        if (isPlaying) requestRef.current = requestAnimationFrame(animate);
        else if (requestRef.current) cancelAnimationFrame(requestRef.current);
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [isPlaying]);

    const handlePlayPause = () => {
        if (isPlaying) {
            audioRefA.current?.pause();
            audioRefB.current?.pause();
        } else {
            audioRefA.current?.play();
            audioRefB.current?.play();
            const durA = audioRefA.current?.duration || 0;
            const durB = audioRefB.current?.duration || 0;
            setDuration(Math.max(durA, durB));
        }
        setIsPlaying(!isPlaying);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (audioRefA.current) audioRefA.current.currentTime = time;
        if (audioRefB.current) audioRefB.current.currentTime = time;
        setCurrentTime(time);
    };

    // Piano Roll Audio Preview
    const playNote = (midi: number) => {
        if (!audioCtxRef.current) return;
        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        const freq = 440 * Math.pow(2, (midi - 69) / 12);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    };


    // Stats Processing
    const getEvents = (item: DashboardEntry | undefined) => {
        const backendItem = item as any;
        if (!backendItem) return [];
        try {
            if (backendItem.event_data) {
                return Array.isArray(backendItem.event_data) ? backendItem.event_data : JSON.parse(backendItem.event_data);
            } else if (backendItem.events) {
                return Array.isArray(backendItem.events) ? backendItem.events : JSON.parse(backendItem.events);
            }
        } catch (e) {
            return [];
        }
        return [];
    };

    const normalizeEvent = (ev: any) => {
        // Arrays: 0:time, 1:dur, 2:midi, 3:vel, 4:x, 5:y, 6:note
        return {
            time: ev.time || ev[0] || 0,
            duration: ev.duration || ev[1] || 0,
            midi: ev.midiFloat || ev[2] || 0,
            velocity: ev.velocity || ev[3] || 0,
            note: ev.noteName || ev[6] || '?',
        };
    };

    const statsA = useMemo(() => {
        const events = getEvents(itemA).map(normalizeEvent);
        if (!events.length) return null;
        return { events, avgPitch: events.reduce((a: number, b: any) => a + b.midi, 0) / events.length, avgVel: events.reduce((a: number, b: any) => a + b.velocity, 0) / events.length };
    }, [itemA]);

    const statsB = useMemo(() => {
        const events = getEvents(itemB).map(normalizeEvent);
        if (!events.length) return null;
        return { events, avgPitch: events.reduce((a: number, b: any) => a + b.midi, 0) / events.length, avgVel: events.reduce((a: number, b: any) => a + b.velocity, 0) / events.length };
    }, [itemB]);

    const scatterData = useMemo(() => {
        const dataA = (statsA?.events || []).map((e: any) => ({ x: e.time, y: e.midi, z: e.velocity, type: 'A' }));
        const dataB = (statsB?.events || []).map((e: any) => ({ x: e.time, y: e.midi, z: e.velocity, type: 'B' }));
        return { A: dataA, B: dataB };
    }, [statsA, statsB]);

    const similarityScore = useMemo(() => {
        if (!statsA || !statsB) return 0;
        const diffPitch = Math.abs(statsA.avgPitch - statsB.avgPitch);
        const diffVel = Math.abs(statsA.avgVel - statsB.avgVel);
        const score = 100 - (diffPitch * 0.5 + diffVel * 20);
        return Math.max(0, Math.min(100, Math.round(score)));
    }, [statsA, statsB]);


    if (!user) return <div className="text-center pt-32 text-white">Effettua il login.</div>;
    if (isLoading) return <div className="text-center pt-32 text-brand-accent">Caricamento...</div>;

    return (
        <div className="max-w-7xl mx-auto pb-20">
            <div className="mb-10 text-center">
                <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-accent to-purple-500 mb-2">
                    Studio Comparativo
                </h2>
            </div>

            {/* Selection */}
            <div className="grid grid-cols-2 gap-8 mb-8 bg-white/5 p-6 rounded-2xl border border-white/10">
                <div>
                    <select value={idA} onChange={(e) => setIdA(e.target.value)} className="w-full bg-black/40 border-2 border-brand-accent/30 text-white rounded-xl p-3 mb-4">
                        <option value="">Opera A (Cyan)</option>
                        {history.map(h => <option key={h.id} value={h.id}>{h.title || h.traditionName}</option>)}
                    </select>
                    {itemA && <div className="flex items-center gap-4"><img src={itemA.imageUrl} className="w-12 h-12 rounded border border-brand-accent" /><span className="text-brand-accent font-bold">{itemA.title}</span></div>}
                    {itemA?.audioUrl && <audio ref={audioRefA} src={itemA.audioUrl} preload="auto" />}
                </div>
                <div>
                    <select value={idB} onChange={(e) => setIdB(e.target.value)} className="w-full bg-black/40 border-2 border-purple-500/30 text-white rounded-xl p-3 mb-4">
                        <option value="">Opera B (Purple)</option>
                        {history.map(h => <option key={h.id} value={h.id}>{h.title || h.traditionName}</option>)}
                    </select>
                    {itemB && <div className="flex items-center gap-4"><img src={itemB.imageUrl} className="w-12 h-12 rounded border border-purple-500" /><span className="text-purple-500 font-bold">{itemB.title}</span></div>}
                    {itemB?.audioUrl && <audio ref={audioRefB} src={itemB.audioUrl} preload="auto" />}
                </div>
            </div>

            {itemA && itemB && (
                <div className="space-y-8 animate-fade-in">

                    {/* Master Player */}
                    <div className="bg-[#0f172a] p-6 rounded-2xl border border-white/20 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-white"><i className="fas fa-sliders-h mr-2"></i>Playback Sincronizzato</h3>
                            <div className="text-brand-accent font-mono text-xl">{currentTime.toFixed(1)}s</div>
                        </div>

                        {/* Timeline */}
                        <input
                            type="range"
                            min="0"
                            max={duration || 100}
                            value={currentTime}
                            onChange={handleSeek}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer mb-6"
                        />

                        <div className="flex items-center gap-8">
                            <button onClick={handlePlayPause} className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition">
                                <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-2xl`}></i>
                            </button>

                            {/* Crossfader */}
                            <div className="flex-1 flex items-center gap-4 bg-black/30 p-4 rounded-xl border border-white/10">
                                <span className="text-brand-accent font-bold">A</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={crossfade}
                                    onChange={(e) => setCrossfade(parseInt(e.target.value))}
                                    className="w-full appearance-none h-4 bg-gradient-to-r from-brand-accent via-gray-500 to-purple-500 rounded-lg slider-thumb-white"
                                />
                                <span className="text-purple-500 font-bold">B</span>
                            </div>
                        </div>
                        <p className="text-center text-xs text-white/40 mt-2">Usa il crossfader per mixare tra le due tracce in tempo reale.</p>
                    </div>

                    {/* Waveform Overlay */}
                    <div className="bg-[#0f172a] p-6 rounded-2xl border border-white/10 h-[300px]">
                        <h3 className="text-xl font-bold text-white mb-4">Confronto Forme d'Onda (Ampiezza)</h3>
                        {isAnalyzing ? (
                            <div className="flex justify-center items-center h-full text-brand-accent animate-pulse">Analisi Audio in corso...</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="85%">
                                <AreaChart data={waveformData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                    <XAxis dataKey="time" hide />
                                    <YAxis hide />
                                    <Tooltip contentStyle={{ backgroundColor: '#1e1e2e', border: 'none', color: '#fff' }} />
                                    <Area type="monotone" dataKey="ampA" stackId="1" stroke="#2dd4bf" fill="#2dd4bf" fillOpacity={0.5} name="Opera A" />
                                    <Area type="monotone" dataKey="ampB" stackId="2" stroke="#a855f7" fill="#a855f7" fillOpacity={0.5} name="Opera B" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                        <p className="text-center text-xs text-white/40 mt-2">Visualizzazione ampiezza reale sovrapposta.</p>
                    </div>

                    {/* Piano Roll */}
                    <div className="bg-[#1e1e2e] p-6 rounded-2xl border border-white/10 h-[500px] relative group">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Piano Roll (Confronto Eventi)</h3>
                            <div className="flex items-center gap-4">
                                <button onClick={() => setIsZoomModalOpen(true)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-xs font-bold transition">
                                    <i className="fas fa-expand mr-2"></i>INGRANDISCI
                                </button>
                                <div className="bg-white/10 px-4 py-2 rounded-lg border border-white/20">
                                    <span className="text-white/60 text-sm mr-2">Indice Similarità:</span>
                                    <span className={`text-xl font-black ${similarityScore > 80 ? 'text-green-400' : similarityScore > 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                        {similarityScore}%
                                    </span>
                                </div>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height="85%">
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }} onMouseDown={(e: any) => e && e.activePayload && playNote(e.activePayload[0].payload.y)}>
                                <XAxis type="number" dataKey="x" name="Time" unit="s" stroke="#94a3b8" />
                                <YAxis type="number" dataKey="y" name="Midi" domain={['auto', 'auto']} stroke="#94a3b8" />
                                <ZAxis type="number" dataKey="z" range={[50, 400]} name="Velocity" />
                                <Tooltip
                                    cursor={{ strokeDasharray: '3 3' }}
                                    contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #ffffff30', color: '#fff' }}
                                />
                                <Legend />
                                <Scatter name="Opera A" data={scatterData.A} fill="#2dd4bf" shape="circle" onMouseEnter={(data: any) => playNote(data.y)} />
                                <Scatter name="Opera B" data={scatterData.B} fill="#a855f7" shape="square" onMouseEnter={(data: any) => playNote(data.y)} />
                            </ScatterChart>
                        </ResponsiveContainer>
                        <p className="text-center text-xs text-white/40">Passa il mouse sui punti per ascoltare la nota. Clicca "Ingrandisci" per i dettagli.</p>
                    </div>

                    {/* Zoom Modal */}
                    {isZoomModalOpen && (
                        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col p-8 animate-zoom-in">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-3xl font-black text-white">Analisi Dettagliata</h2>
                                <button onClick={() => setIsZoomModalOpen(false)} className="text-white hover:text-red-500 text-2xl"><i className="fas fa-times"></i></button>
                            </div>
                            <div className="flex-1 bg-[#1e1e2e] rounded-2xl p-4 border border-white/10">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                        <XAxis type="number" dataKey="x" name="Time" unit="s" stroke="#94a3b8" />
                                        <YAxis type="number" dataKey="y" name="Midi" domain={['auto', 'auto']} stroke="#94a3b8" />
                                        <ZAxis type="number" dataKey="z" range={[100, 800]} name="Velocity" />
                                        <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #ffffff30', color: '#fff' }} />
                                        <Legend />
                                        <Scatter name="Opera A" data={scatterData.A} fill="#2dd4bf" shape="circle" onMouseEnter={(data: any) => playNote(data.y)} />
                                        <Scatter name="Opera B" data={scatterData.B} fill="#a855f7" shape="square" onMouseEnter={(data: any) => playNote(data.y)} />
                                    </ScatterChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
