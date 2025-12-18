import React from "react";
import { useRouteError } from "react-router-dom";

export const ErrorPage = () => {
    const error: any = useRouteError();
    console.error(error);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-6 text-center font-sans">
            <div className="bg-brand-secondary/30 p-8 rounded-2xl border border-white/10 shadow-2xl max-w-lg w-full backdrop-blur-md">
                <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                    <i className="fas fa-exclamation-triangle"></i>
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">Qualcosa è andato storto</h1>
                <p className="text-brand-text-secondary mb-6">
                    Il sistema ha riscontrato un errore imprevisto durante l'elaborazione dell'interfaccia.
                </p>

                {error && (
                    <div className="bg-black/40 p-4 rounded text-left text-xs text-red-300 font-mono mb-6 overflow-auto max-h-40 border border-red-500/20">
                        {error.statusText || error.message || String(error)}
                    </div>
                )}

                <button
                    onClick={() => window.location.href = '/'}
                    className="w-full py-3 bg-brand-accent text-brand-primary rounded-lg font-bold hover:bg-brand-accent-light transition-colors shadow-lg"
                >
                    <i className="fas fa-redo-alt mr-2"></i> Ricarica Applicazione
                </button>
            </div>
        </div>
    );
};
