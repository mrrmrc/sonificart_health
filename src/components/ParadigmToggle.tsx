import React from 'react';
import { Paradigm } from '../types';

interface ParadigmToggleProps {
  selectedParadigm: Paradigm;
  onParadigmChange: (paradigm: Paradigm) => void;
  isPro?: boolean;
  onReTrigger?: (paradigm: Paradigm) => void;
}

export const ParadigmToggle: React.FC<ParadigmToggleProps> = ({ selectedParadigm, onParadigmChange, isPro = false, onReTrigger }) => {
  const handleSelect = (p: Paradigm) => {
    onParadigmChange(p);
    if (onReTrigger) {
      onReTrigger(p);
    }
  };

  const getButtonClass = (paradigm: Paradigm) => {
    const base = "w-full py-2 px-4 text-sm font-bold rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-secondary flex items-center justify-center";
    if (paradigm === selectedParadigm) {
      return `${base} bg-brand-accent text-brand-primary shadow-lg ring-2 ring-emerald-400`;
    }
    return `${base} bg-brand-primary/50 text-brand-text-secondary hover:bg-brand-secondary/70`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-1 bg-brand-secondary rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-1">
      <button
        onClick={() => handleSelect('scientific')}
        className={getButtonClass('scientific')}
        aria-pressed={selectedParadigm === 'scientific'}
      >
        <i className="fas fa-flask mr-2"></i>
        Scientifico
        {!isPro && <span className="ml-1.5 bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">1 CR</span>}
      </button>
      <button
        onClick={() => handleSelect('hybrid')}
        className={getButtonClass('hybrid')}
        aria-pressed={selectedParadigm === 'hybrid'}
      >
        <i className="fas fa-layer-group mr-2"></i>
        Ibrido
        {!isPro && <span className="ml-1.5 bg-yellow-500 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded">2 CR</span>}
      </button>
      <button
        onClick={() => handleSelect('artistic')}
        className={getButtonClass('artistic')}
        aria-pressed={selectedParadigm === 'artistic'}
      >
        <i className="fas fa-palette mr-2"></i>
        Artistico
        {!isPro && <span className="ml-1.5 bg-yellow-500 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded">2 CR</span>}
      </button>
      <button
        onClick={() => handleSelect('ai_composer')}
        className={getButtonClass('ai_composer')}
        aria-pressed={selectedParadigm === 'ai_composer'}
      >
        <i className="fas fa-robot mr-2 text-emerald-400"></i>
        AI Composer
        {!isPro && <span className="ml-1.5 bg-emerald-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded">WHO</span>}
      </button>
    </div>
  );
};