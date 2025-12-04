import React, { useState, useCallback, useEffect } from 'react';
import { verifySacContainer } from '../services/sacService';
import { SacVerificationResult, User } from '../types';

type VerificationStatus = 'idle' | 'scanning' | 'analyzing' | 'valid' | 'invalid' | 'error' | 'not_found';

interface VerificationPortalProps {
    user: User | null;
    onLogin: () => void;
    // Nuova prop per passare il file validato alla App
    onLoadSacProject?: (file: File, result: SacVerificationResult) => void;
}

const FileUploader: React.FC<{ onFileSelect: (file: File) => void }> = ({ onFileSelect }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleFile = useCallback((file: File) => {
        if (!file.name.toLowerCase().endsWith('.sac')) {
            alert("Per la verifica, carica un file .SAC valido.");
            return;
        }
        onFileSelect(file);
    }, [onFileSelect]);

    const handleDragEnter = useCallback((e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
    const handleDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
    const handleDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.stopPropagation(); }, []);

    const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
    }, [handleFile]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) handleFile(e.target.files[0]);
    };

    return (
        <label
            onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}
            className={`relative flex flex-col justify-center items-center w-full h-80 px-4 transition-all duration-500 bg-black/40 border-2 rounded-2xl appearance-none cursor-pointer group overflow-hidden ${isDragging ? 'border-brand-accent bg-brand-accent/5 shadow-[0_0_30px_rgba(45,212,191,0.2)]' : 'border-dashed border-white/10 hover:border-brand-accent/50 hover:bg-white/5'}`}
        >
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
                style={{
                    backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.5) 1px, transparent 1px)',
                    backgroundSize: '40px 40px'
                }}
            ></div>

            <div className={`relative z-10 w-24 h-24 rounded-full bg-brand-secondary/80 border border-white/10 flex items-center justify-center mb-6 transition-transform duration-300 ${isDragging ? 'scale-110' : 'group-hover:scale-105'}`}>
                <i className="fas fa-box-open text-5xl text-brand-text-secondary group-hover:text-brand-accent transition-colors"></i>
                {isDragging && <div className="absolute inset-0 rounded-full border-2 border-brand-accent animate-ping"></div>}
            </div>

            <h3 className="relative z-10 font-display font-bold text-white text-2xl mb-2">
                Carica Container .SAC
            </h3>
            <p className="relative z-10 text-sm text-brand-text-secondary text-center max-w-md leading-relaxed mb-6">
                Trascina qui il file <strong>.sac</strong> per analizzare l'integrità del pacchetto, il manifest crittografico e i certificati interni.
            </p>

            <div className="relative z-10 flex gap-3 text-[10px] text-brand-text-secondary/50 uppercase tracking-widest font-mono">
                <span className="flex items-center gap-1"><i className="fas fa-archive"></i> SAC FORMAT REQUIRED</span>
                <span className="flex items-center gap-1"><i className="fas fa-shield-alt"></i> SECURE CHECK</span>
            </div>

            <input
                type="file"
                name="file_upload"
                className="hidden"
                accept=".sac"
                onChange={handleFileChange}
            />
        </label>
    );
};

const ScannerAnimation: React.FC = () => (
    <div className="flex flex-col items-center justify-center h-80 relative overflow-hidden bg-black/60 rounded-2xl border border-brand-accent/20">
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(transparent_0%,rgba(45,212,191,0.1)_50%,transparent_100%)] animate-scan"></div>
        <div className="w-32 h-32 border-4 border-brand-accent/30 rounded-full flex items-center justify-center relative">
            <div className="absolute inset-0 border-4 border-t-brand-accent border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
            <i className="fas fa-search text-4xl text-brand-accent animate-pulse"></i>
        </div>
        <h3 className="mt-8 text-xl font-bold text-white tracking-widest animate-pulse">SCANSIONE CONTAINER...</h3>
        <div className="mt-2 font-mono text-xs text-brand-accent">VERIFICA FIRME DIGITALI</div>
    </div>
);

const NotFoundResultDisplay: React.FC<{ fileName: string, onReset: () => void, details?: string }> = ({ fileName, onReset, details }) => (
    <div className="p-8 border border-red-900/50 rounded-xl bg-[#0f0505] animate-fade-in relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>

        <div className="flex flex-col items-center text-center mb-8 relative z-10">
            <div className="w-20 h-20 rounded-full bg-red-900/20 flex items-center justify-center text-red-500 text-4xl mb-4 border border-red-500/30">
                <i className="fas fa-times"></i>
            </div>
            <h3 className="text-2xl font-bold text-red-100 mb-2">Verifica Fallita</h3>
            <p className="text-red-200/60 text-sm max-w-md">
                Il file <strong>"{fileName}"</strong> non ha superato i controlli di integrità.
            </p>
        </div>

        <div className="bg-red-950/30 border border-red-900/50 p-4 rounded-lg text-left mb-8 text-xs text-red-200/80 space-y-2">
            <p className="font-bold uppercase mb-2">Dettagli Errore:</p>
            <p className="font-mono">{details || "Container corrotto o manomesso."}</p>
        </div>

        <button onClick={onReset} className="w-full bg-red-900/20 hover:bg-red-900/40 text-red-200 font-bold py-3 rounded-lg transition-colors border border-red-800/30">
            Riprova
        </button>
    </div>
);

interface VerificationResultDisplayProps {
    result: SacVerificationResult;
    file: File;
    onReset: () => void;
    onLoad: () => void;
}

const VerificationResultDisplay: React.FC<VerificationResultDisplayProps> = ({ result, file, onReset, onLoad }) => {
    const { isValid, details, manifestData } = result;
    const [scannedItems, setScannedItems] = useState<string[]>([]);

    // Effetto "Scansione Progressiva"
    useEffect(() => {
        if (!details) return;
        const keys = Object.keys(details);
        let i = 0;
        const interval = setInterval(() => {
            if (i < keys.length) {
                setScannedItems(prev => [...prev, keys[i]]);
                i++;
            } else {
                clearInterval(interval);
            }
        }, 150); // Velocità animazione (ms per riga)
        return () => clearInterval(interval);
    }, [details]);

    const isScanComplete = scannedItems.length === Object.keys(details || {}).length;

    if (!isValid) return <NotFoundResultDisplay fileName={file.name} onReset={onReset} details="Hash mismatch or missing files." />;

    return (
        <div className="relative rounded-xl overflow-hidden bg-[#0a0a0c] border border-brand-secondary shadow-2xl animate-fade-in">
            <div className="h-1 w-full bg-gradient-to-r from-green-400 to-teal-500"></div>

            <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* COLONNA SX: RISULTATO MACRO */}
                <div className="flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400 text-3xl border border-teal-500/30 shadow-[0_0_20px_rgba(20,184,166,0.2)]">
                                <i className="fas fa-shield-check"></i>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-white">Container Valido</h3>
                                <p className="text-green-400 font-mono text-xs uppercase mt-1 tracking-wider">
                                    <i className="fas fa-check-circle mr-1"></i> Firma Crittografica Autentica
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                                <div className="text-[10px] text-brand-text-secondary uppercase font-bold mb-1">Data Creazione</div>
                                <div className="font-mono text-white">{new Date(manifestData.created_at).toLocaleString()}</div>
                            </div>
                            <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                                <div className="text-[10px] text-brand-text-secondary uppercase font-bold mb-1">ID Univoco (Hash)</div>
                                <div className="font-mono text-xs text-brand-accent break-all">
                                    {/* FIX: Cast a any per evitare errori TS se la proprietà non è definita nell'interfaccia */}
                                    {(manifestData as any).sac_hash?.substring(0, 32) || (manifestData as any).hash?.substring(0, 32) || '---'}...
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        {isScanComplete ? (
                            <button onClick={onLoad} className="flex-1 py-4 bg-brand-accent hover:bg-brand-accent-light text-brand-primary font-bold rounded-lg transition-all shadow-lg hover:shadow-brand-accent/30 flex items-center justify-center gap-2 animate-zoom-in">
                                <i className="fas fa-folder-open"></i> Apri Opera nell'Editor
                            </button>
                        ) : (
                            <button disabled className="flex-1 py-4 bg-white/5 text-gray-500 font-bold rounded-lg cursor-wait border border-white/5">
                                <i className="fas fa-circle-notch fa-spin mr-2"></i> Analisi in corso...
                            </button>
                        )}
                        <button onClick={onReset} className="px-4 py-4 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 transition-colors" title="Verifica altro file">
                            <i className="fas fa-redo"></i>
                        </button>
                    </div>
                </div>

                {/* COLONNA DX: LOG SCANSIONE DETTAGLIATO */}
                <div className="bg-black/40 rounded-lg border border-white/10 p-4 font-mono text-xs overflow-y-auto max-h-[400px] custom-scrollbar relative flex flex-col">
                    <div className="absolute top-2 right-2 text-[10px] text-brand-text-secondary uppercase tracking-widest animate-pulse">Live Scan</div>
                    <div className="space-y-2">
                        <div className="text-gray-500 border-b border-gray-800 pb-2 mb-2">Target: {file.name}</div>

                        {details && Object.keys(details).map((filename) => {
                            const isScanned = scannedItems.includes(filename);
                            return (
                                <div key={filename} className={`flex items-center justify-between p-2 rounded transition-all duration-300 ${isScanned ? 'bg-green-500/5 border-l-2 border-green-500 opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
                                    <span className="flex items-center gap-2 text-gray-300">
                                        <i className={`fas ${filename.endsWith('json') ? 'fa-file-code' : filename.endsWith('wav') ? 'fa-file-audio' : 'fa-file-image'} w-4 text-center text-brand-text-secondary`}></i>
                                        {filename}
                                    </span>
                                    <span className="font-bold text-green-400">
                                        [OK]
                                    </span>
                                </div>
                            );
                        })}

                        {isScanComplete && (
                            <div className="mt-4 pt-4 border-t border-green-500/30 text-green-400 font-bold animate-pulse">
                                &gt;&gt; VERIFICA INTEGRITÀ COMPLETATA.
                                <br />
                                &gt;&gt; SIGNATURE MATCH: TRUE
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};


export const VerificationPortal: React.FC<VerificationPortalProps> = ({ user, onLogin, onLoadSacProject }) => {
    const [status, setStatus] = useState<VerificationStatus>('idle');
    const [result, setResult] = useState<SacVerificationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);

    const handleFileSelect = useCallback(async (file: File) => {
        setStatus('scanning');
        setUploadedFile(file);
        setError(null);

        await new Promise(r => setTimeout(r, 1500)); // Delay per animazione UX

        try {
            const verificationResult = await verifySacContainer(file);
            setResult(verificationResult);
            setStatus(verificationResult.isValid ? 'valid' : 'not_found');
        } catch (e) {
            setStatus('error');
            setError(e instanceof Error ? e.message : "Errore generico durante la verifica.");
        }
    }, []);

    const reset = () => {
        setStatus('idle');
        setResult(null);
        setError(null);
        setUploadedFile(null);
    };

    const handleLoad = () => {
        if (onLoadSacProject && uploadedFile && result) {
            onLoadSacProject(uploadedFile, result);
        } else {
            alert("Funzionalità di caricamento non disponibile.");
        }
    };

    // LOGIN LOCK SCREEN
    if (!user) {
        return (
            <div className="max-w-4xl mx-auto py-12 px-4 animate-fade-in">
                <div className="text-center mb-12">
                    <h2 className="text-4xl font-bold text-white mb-4">Certificazione Trustless</h2>
                    <p className="text-brand-text-secondary max-w-xl mx-auto">
                        Accesso riservato. Il protocollo di verifica forense richiede l'identificazione dell'utente.
                    </p>
                </div>
                <div className="bg-[#0a0a0c] rounded-2xl border border-red-900/30 p-12 shadow-2xl text-center flex flex-col items-center justify-center">
                    <div className="w-20 h-20 bg-red-900/20 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
                        <i className="fas fa-lock text-3xl text-red-500"></i>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Accesso Negato</h3>
                    <p className="text-brand-text-secondary mb-8 max-w-md">
                        Per garantire la tracciabilità delle operazioni di verifica e certificazione, è necessario effettuare il login alla piattaforma.
                    </p>
                    <button
                        onClick={onLogin}
                        className="px-8 py-3 bg-brand-accent hover:bg-brand-accent-light text-brand-primary font-bold rounded-full transition-colors shadow-lg"
                    >
                        Accedi Ora
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto py-12 px-4 animate-fade-in">

            {/* HEADER */}
            <div className="text-center mb-12">
                <h2 className="text-4xl font-bold text-white mb-4">Certificazione Trustless</h2>
                <p className="text-brand-text-secondary max-w-xl mx-auto">
                    Il protocollo di verifica garantisce l'autenticità forense di ogni opera generata tramite l'analisi del container SAC.
                </p>
            </div>

            {status === 'idle' && (
                <div className="bg-[#0a0a0c] rounded-2xl border border-white/10 p-4 sm:p-12 shadow-2xl">
                    <FileUploader onFileSelect={handleFileSelect} />
                </div>
            )}

            {status === 'scanning' && <ScannerAnimation />}

            {status === 'valid' && result && uploadedFile && (
                <VerificationResultDisplay
                    result={result}
                    file={uploadedFile}
                    onReset={reset}
                    onLoad={handleLoad}
                />
            )}

            {status === 'not_found' && uploadedFile && <NotFoundResultDisplay fileName={uploadedFile.name} onReset={reset} details="La firma crittografica del pacchetto non corrisponde o il file è stato alterato." />}

            {status === 'error' && (
                <div className="p-8 border border-red-500/30 bg-red-900/20 rounded-xl text-center animate-fade-in">
                    <i className="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                    <h3 className="text-2xl font-bold text-white mb-2">Errore di Lettura</h3>
                    <p className="text-red-200 mb-6">{error}</p>
                    <button onClick={reset} className="px-6 py-2 bg-red-900/40 hover:bg-red-900/60 text-white rounded border border-red-500/30 transition-colors">Riprova</button>
                </div>
            )}

        </div>
    );
};