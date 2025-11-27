
import React, { useState, useCallback } from 'react';
import { verifySacContainer } from '../services/sacService';
import { SacVerificationResult, User } from '../types';

type VerificationStatus = 'idle' | 'scanning' | 'analyzing' | 'valid' | 'invalid' | 'error' | 'not_found';

interface VerificationPortalProps {
    user: User | null;
    onLogin: () => void;
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
            {/* Scanning Grid Background */}
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

const VerificationResultDisplay: React.FC<{ result: SacVerificationResult, file: File, onReset: () => void }> = ({ result, file, onReset }) => {
    const { isValid, details, manifestData, extractedVideoBlob } = result;
    
    if (isValid) {
        return (
            <div className="relative rounded-xl overflow-hidden bg-[#0a0a0c] border border-brand-secondary shadow-2xl animate-fade-in">
                <div className="h-2 w-full bg-gradient-to-r from-green-400 to-teal-500"></div>
                
                <div className="p-8">
                    <div className="flex justify-between items-start mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-400 text-2xl border border-teal-500/30">
                                <i className="fas fa-box-check"></i>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-white">Container SAC Valido</h3>
                                <p className="text-green-400 font-mono text-xs uppercase mt-1">Integrity Check: PASSED</p>
                            </div>
                        </div>
                        <div className="text-right hidden sm:block">
                            <div className="text-brand-text-secondary text-xs uppercase tracking-wider">Data Creazione</div>
                            <div className="text-white font-mono font-bold">{new Date(manifestData.created_at).toLocaleDateString()}</div>
                        </div>
                    </div>

                    {extractedVideoBlob && (
                        <div className="mb-8 rounded-lg overflow-hidden border border-brand-secondary bg-black relative group">
                            <div className="absolute top-3 left-3 z-10 bg-black/70 backdrop-blur px-2 py-1 rounded border border-white/10 text-[10px] font-bold text-white uppercase flex items-center gap-2">
                                <i className="fas fa-play-circle text-teal-400"></i> Media Estratto
                            </div>
                            <video src={URL.createObjectURL(extractedVideoBlob)} controls className="w-full max-h-[300px] object-contain" />
                        </div>
                    )}

                    <div className="space-y-2 mb-8">
                        <h4 className="text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-3">Analisi Contenuto</h4>
                        <div className="grid grid-cols-1 gap-2">
                            {details && Object.entries(details).map(([filename, detail]) => (
                                <div key={filename} className="flex items-center justify-between p-3 bg-white/5 rounded border border-white/5">
                                    <span className="text-sm text-white font-mono flex items-center gap-3">
                                        <i className={`fas ${filename.endsWith('json') ? 'fa-file-code' : 'fa-file-media'} text-brand-text-secondary`}></i>
                                        {filename}
                                    </span>
                                    <span className="text-xs font-bold text-green-400 bg-green-900/20 px-2 py-1 rounded border border-green-900/30">MATCH</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg mb-6 flex items-start gap-3">
                        <i className="fas fa-info-circle text-blue-400 mt-1"></i>
                        <div>
                            <p className="text-sm text-blue-200 font-bold">Archivio Certificato (Read-Only)</p>
                            <p className="text-xs text-blue-200/70">
                                Questo container SAC è stato verificato con successo. Per garantire l'immutabilità dell'opera forense, 
                                il progetto non può essere modificato o riaperto in modalità edit.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={onReset} className="flex-1 py-3 bg-brand-secondary hover:bg-brand-secondary/80 border border-brand-secondary rounded-lg text-brand-text-secondary font-bold transition-all text-sm">
                            Verifica Altro File
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return <NotFoundResultDisplay fileName={file.name} onReset={onReset} details="Hash mismatch or missing files." />;
};


export const VerificationPortal: React.FC<VerificationPortalProps> = ({ user, onLogin }) => {
    const [status, setStatus] = useState<VerificationStatus>('idle');
    const [result, setResult] = useState<SacVerificationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);

    const handleFileSelect = useCallback(async (file: File) => {
        setStatus('scanning');
        setUploadedFile(file);
        setError(null);

        await new Promise(r => setTimeout(r, 2000)); // UX Delay for scanning animation

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
        <div className="max-w-4xl mx-auto py-12 px-4 animate-fade-in">
            
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
