/**
 * VerificationTool Component
 * 
 * Fornisce un'interfaccia per:
 * 1. Caricare un pacchetto forensico (.sonificart)
 * 2. Caricare un file da verificare
 * 3. Confrontare e mostrare il risultato
 * 4. Estrarre il file originale certificato
 */

import { useState, useRef } from 'react';
import {
    readForensicPackage,
    verifyFileAgainstPackage,
    extractOriginalFromPackage,
    ForensicPackageContents
} from '../services/forensicPackageService';
import { saveAs } from 'file-saver';

interface VerificationResult {
    isMatch: boolean;
    details: {
        expectedHash: string;
        actualHash: string;
        expectedSize: number;
        actualSize: number;
        hashMatch: boolean;
        sizeMatch: boolean;
    };
}

export default function VerificationTool() {
    const [packageContents, setPackageContents] = useState<ForensicPackageContents | null>(null);
    const [packageFileName, setPackageFileName] = useState<string>('');
    const [fileToVerify, setFileToVerify] = useState<File | null>(null);
    const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

    const packageInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePackageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setError(null);
        setVerificationResult(null);
        setPackageContents(null);

        try {
            const contents = await readForensicPackage(file);
            setPackageContents(contents);
            setPackageFileName(file.name);

            // Create thumbnail URL
            if (contents.thumbnailBlob) {
                const url = URL.createObjectURL(contents.thumbnailBlob);
                setThumbnailUrl(url);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore nel caricamento del pacchetto');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileToVerify = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileToVerify(file);
        setVerificationResult(null);

        // Auto-verify if package is already loaded
        if (packageContents) {
            await runVerification(file, packageContents);
        }
    };

    const runVerification = async (file: File, contents: ForensicPackageContents) => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await verifyFileAgainstPackage(file, contents);
            setVerificationResult(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore nella verifica');
        } finally {
            setIsLoading(false);
        }
    };

    const handleExtractOriginal = async () => {
        if (!packageContents) return;

        try {
            const { blob, fileName, metadata } = await extractOriginalFromPackage(packageContents);
            saveAs(blob, fileName);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore nell\'estrazione');
        }
    };

    const formatBytes = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    const formatHash = (hash: string): string => {
        return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
    };

    return (
        <div className="verification-tool" style={{
            maxWidth: '800px',
            margin: '0 auto',
            padding: '2rem',
            fontFamily: 'Inter, sans-serif'
        }}>
            <h1 style={{
                fontSize: '2rem',
                fontWeight: 700,
                marginBottom: '0.5rem',
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
            }}>
                🔬 Verifica Autenticità
            </h1>
            <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>
                Confronta un file con un certificato SonificA.R.T. per verificarne l'autenticità
            </p>

            {/* Step 1: Load Package */}
            <div style={{
                background: 'rgba(30, 41, 59, 0.8)',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '1rem',
                border: packageContents ? '2px solid #22c55e' : '2px solid transparent'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <span style={{
                        background: packageContents ? '#22c55e' : '#6366f1',
                        color: 'white',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.875rem'
                    }}>
                        {packageContents ? '✓' : '1'}
                    </span>
                    <h3 style={{ margin: 0, color: 'white', fontSize: '1.1rem' }}>
                        Carica Pacchetto Certificato
                    </h3>
                </div>

                <input
                    ref={packageInputRef}
                    type="file"
                    accept=".sac,.sonificart,.zip"
                    onChange={handlePackageUpload}
                    style={{ display: 'none' }}
                />

                {!packageContents ? (
                    <button
                        onClick={() => packageInputRef.current?.click()}
                        disabled={isLoading}
                        style={{
                            width: '100%',
                            padding: '1rem',
                            background: 'rgba(99, 102, 241, 0.2)',
                            border: '2px dashed #6366f1',
                            borderRadius: '8px',
                            color: '#a5b4fc',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        {isLoading ? '⏳ Caricamento...' : '📦 Seleziona file .sac (Forensic Package)'}
                    </button>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: thumbnailUrl ? '100px 1fr' : '1fr',
                        gap: '1rem',
                        alignItems: 'start'
                    }}>
                        {thumbnailUrl && (
                            <img
                                src={thumbnailUrl}
                                alt="Preview"
                                style={{
                                    width: '100px',
                                    height: '100px',
                                    objectFit: 'cover',
                                    borderRadius: '8px',
                                    border: '2px solid #334155'
                                }}
                            />
                        )}
                        <div>
                            <p style={{ color: '#22c55e', margin: '0 0 0.5rem 0', fontWeight: 600 }}>
                                ✅ Pacchetto Caricato
                            </p>
                            <p style={{ color: '#94a3b8', margin: '0 0 0.25rem 0', fontSize: '0.875rem' }}>
                                <strong>File:</strong> {packageFileName}
                            </p>
                            <p style={{ color: '#94a3b8', margin: '0 0 0.25rem 0', fontSize: '0.875rem' }}>
                                <strong>Originale:</strong> {packageContents.manifest.original_file.filename}
                            </p>
                            <p style={{ color: '#94a3b8', margin: '0 0 0.25rem 0', fontSize: '0.875rem' }}>
                                <strong>Dimensioni:</strong> {packageContents.manifest.original_file.dimensions.width} × {packageContents.manifest.original_file.dimensions.height} px
                            </p>
                            <p style={{ color: '#94a3b8', margin: '0 0 0.25rem 0', fontSize: '0.875rem' }}>
                                <strong>Peso:</strong> {formatBytes(packageContents.manifest.original_file.size_bytes)}
                            </p>
                            <p style={{ color: '#f59e0b', margin: '0.5rem 0 0 0', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                                🔐 Hash: {formatHash(packageContents.manifest.original_file.hash_sha256)}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Step 2: Load File to Verify */}
            <div style={{
                background: 'rgba(30, 41, 59, 0.8)',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '1rem',
                opacity: packageContents ? 1 : 0.5,
                pointerEvents: packageContents ? 'auto' : 'none',
                border: fileToVerify && verificationResult?.isMatch ? '2px solid #22c55e' :
                    fileToVerify && verificationResult && !verificationResult.isMatch ? '2px solid #ef4444' :
                        '2px solid transparent'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <span style={{
                        background: verificationResult?.isMatch ? '#22c55e' :
                            verificationResult && !verificationResult.isMatch ? '#ef4444' : '#6366f1',
                        color: 'white',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.875rem'
                    }}>
                        {verificationResult?.isMatch ? '✓' : verificationResult ? '✗' : '2'}
                    </span>
                    <h3 style={{ margin: 0, color: 'white', fontSize: '1.1rem' }}>
                        Carica File da Verificare
                    </h3>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileToVerify}
                    style={{ display: 'none' }}
                />

                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading || !packageContents}
                    style={{
                        width: '100%',
                        padding: '1rem',
                        background: 'rgba(99, 102, 241, 0.2)',
                        border: '2px dashed #6366f1',
                        borderRadius: '8px',
                        color: '#a5b4fc',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        transition: 'all 0.2s'
                    }}
                >
                    {isLoading ? '⏳ Verifica in corso...' :
                        fileToVerify ? `📄 ${fileToVerify.name}` :
                            '🖼️ Seleziona file immagine da verificare'}
                </button>
            </div>

            {/* Verification Result */}
            {verificationResult && (
                <div style={{
                    background: verificationResult.isMatch ?
                        'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(16, 185, 129, 0.2))' :
                        'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.2))',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    marginBottom: '1rem',
                    border: verificationResult.isMatch ? '2px solid #22c55e' : '2px solid #ef4444'
                }}>
                    <div style={{
                        textAlign: 'center',
                        fontSize: '3rem',
                        marginBottom: '1rem'
                    }}>
                        {verificationResult.isMatch ? '✅' : '❌'}
                    </div>

                    <h2 style={{
                        textAlign: 'center',
                        color: verificationResult.isMatch ? '#22c55e' : '#ef4444',
                        margin: '0 0 1rem 0',
                        fontSize: '1.5rem'
                    }}>
                        {verificationResult.isMatch ?
                            'FILE AUTENTICO' :
                            'FILE NON CORRISPONDENTE'}
                    </h2>

                    <p style={{
                        textAlign: 'center',
                        color: '#94a3b8',
                        margin: '0 0 1.5rem 0'
                    }}>
                        {verificationResult.isMatch ?
                            'Il file caricato corrisponde esattamente all\'originale certificato.' :
                            'Il file caricato è diverso dall\'originale certificato. Potrebbe essere stato modificato.'}
                    </p>

                    {/* Details Table */}
                    <div style={{
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '8px',
                        padding: '1rem',
                        fontFamily: 'monospace',
                        fontSize: '0.75rem'
                    }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <div>
                                <span style={{ color: '#94a3b8' }}>Hash Atteso:</span><br />
                                <span style={{ color: '#f59e0b', wordBreak: 'break-all' }}>
                                    {verificationResult.details.expectedHash}
                                </span>
                            </div>
                            <div>
                                <span style={{ color: '#94a3b8' }}>Hash File:</span><br />
                                <span style={{
                                    color: verificationResult.details.hashMatch ? '#22c55e' : '#ef4444',
                                    wordBreak: 'break-all'
                                }}>
                                    {verificationResult.details.actualHash}
                                </span>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            <div>
                                <span style={{ color: '#94a3b8' }}>Dimensione Attesa:</span><br />
                                <span style={{ color: '#a5b4fc' }}>
                                    {formatBytes(verificationResult.details.expectedSize)}
                                </span>
                            </div>
                            <div>
                                <span style={{ color: '#94a3b8' }}>Dimensione File:</span><br />
                                <span style={{
                                    color: verificationResult.details.sizeMatch ? '#22c55e' : '#ef4444'
                                }}>
                                    {formatBytes(verificationResult.details.actualSize)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Actions */}
            {packageContents && (
                <div style={{
                    display: 'flex',
                    gap: '1rem',
                    justifyContent: 'center'
                }}>
                    <button
                        onClick={handleExtractOriginal}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                            border: 'none',
                            borderRadius: '8px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        📥 Estrai File Originale
                    </button>

                    <button
                        onClick={() => {
                            setPackageContents(null);
                            setFileToVerify(null);
                            setVerificationResult(null);
                            setError(null);
                            setThumbnailUrl(null);
                            setPackageFileName('');
                        }}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: 'transparent',
                            border: '2px solid #475569',
                            borderRadius: '8px',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            fontSize: '1rem'
                        }}
                    >
                        🔄 Reset
                    </button>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    color: '#fca5a5'
                }}>
                    ⚠️ {error}
                </div>
            )}
        </div>
    );
}
