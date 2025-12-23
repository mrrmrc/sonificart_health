import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: (inputValue?: string) => void;
    onCancel?: () => void;
    type?: 'info' | 'warning' | 'danger' | 'success';
    singleButton?: boolean; // If true, acts like an Alert (only OK/Close)
    showInput?: boolean;
    inputPlaceholder?: string;
    initialInputValue?: string;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    title,
    message,
    confirmText,
    cancelText,
    onConfirm,
    onCancel,
    type = 'info',
    singleButton = false,
    showInput = false,
    inputPlaceholder = '',
    initialInputValue = ''
}) => {
    const { t } = useLanguage();
    const [inputValue, setInputValue] = useState(initialInputValue);

    useEffect(() => {
        if (isOpen) setInputValue(initialInputValue);
    }, [isOpen, initialInputValue]);

    if (!isOpen) return null;

    const getColors = () => {
        switch (type) {
            case 'danger': return { bg: 'bg-red-500/10', border: 'border-red-500/50', text: 'text-red-400', button: 'bg-red-600 hover:bg-red-500 text-white' };
            case 'warning': return { bg: 'bg-yellow-500/10', border: 'border-yellow-500/50', text: 'text-yellow-400', button: 'bg-brand-accent hover:bg-brand-accent-light text-brand-primary' };
            case 'success': return { bg: 'bg-green-500/10', border: 'border-green-500/50', text: 'text-green-400', button: 'bg-brand-accent hover:bg-brand-accent-light text-brand-primary' };
            default: return { bg: 'bg-brand-secondary/40', border: 'border-white/10', text: 'text-brand-accent', button: 'bg-brand-accent text-brand-primary hover:bg-brand-accent-light' };
        }
    };

    const colors = getColors();

    const handleConfirm = () => {
        onConfirm(showInput ? inputValue : undefined);
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 animate-fade-in p-4" onClick={() => onCancel && onCancel()}>
            <div className={`relative w-full max-w-md bg-[#1e1e2e] rounded-xl shadow-2xl border ${colors.border} animate-zoom-in overflow-hidden`} onClick={e => e.stopPropagation()}>
                <div className={`p-6 text-center`}>
                    <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 ${colors.bg} ${colors.text}`}>
                        <i className={`fas fa-${type === 'danger' ? 'exclamation-triangle' : type === 'success' ? 'check' : type === 'warning' ? 'exclamation' : 'info-circle'} text-2xl`}></i>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2 font-display">{title}</h3>
                    <p className="text-gray-300 mb-6 leading-relaxed text-sm">{message}</p>

                    {showInput && (
                        <div className="mb-6">
                            <input
                                type="text"
                                autoFocus
                                className="w-full bg-black/40 border border-white/20 p-3 rounded-lg text-white focus:border-brand-accent outline-none text-center"
                                placeholder={inputPlaceholder}
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                            />
                        </div>
                    )}

                    <div className="flex gap-3 justify-center">
                        {!singleButton && onCancel && (
                            <button
                                onClick={onCancel}
                                className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-sm font-bold uppercase tracking-wide"
                            >
                                {cancelText || t('dashboard.cancel')}
                            </button>
                        )}
                        <button
                            onClick={handleConfirm}
                            className={`flex-1 px-4 py-2.5 rounded-lg ${colors.button} transition-colors text-sm font-bold uppercase tracking-wide shadow-lg`}
                        >
                            {confirmText || 'OK'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
