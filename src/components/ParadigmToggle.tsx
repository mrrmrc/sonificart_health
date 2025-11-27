import React from 'react';
import { Paradigm } from '../types';

interface ParadigmToggleProps {
  selectedParadigm: Paradigm;
  onParadigmChange: (paradigm: Paradigm) => void;
}

export const ParadigmToggle: React.FC<ParadigmToggleProps> = ({ selectedParadigm, onParadigmChange }) => {
  const getButtonClass = (paradigm: Paradigm) => {
    const base = "w-full py-2 px-4 text-sm font-bold rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-secondary flex items-center justify-center";
    if (paradigm === selectedParadigm) {
      return `${base} bg-brand-accent text-brand-primary shadow-lg`;
    }
    return `${base} bg-brand-primary/50 text-brand-text-secondary hover:bg-brand-secondary/70`;
  };

  return (
    <div className="w-full max-w-md mx-auto p-1 bg-brand-secondary rounded-lg flex gap-1">
      <button
        onClick={() => onParadigmChange('scientific')}
        className={getButtonClass('scientific')}
        aria-pressed={selectedParadigm === 'scientific'}
      >
        <i className="fas fa-flask mr-2"></i>
        Scientifico
        <span className="ml-2 bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">1 CR</span>
      </button>
      <button
        onClick={() => onParadigmChange('hybrid')}
        className={getButtonClass('hybrid')}
        aria-pressed={selectedParadigm === 'hybrid'}
      >
        <i className="fas fa-layer-group mr-2"></i>
        Ibrido
        <span className="ml-2 bg-yellow-500 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded">2 CR</span>
      </button>
      <button
        onClick={() => onParadigmChange('artistic')}
        className={getButtonClass('artistic')}
        aria-pressed={selectedParadigm === 'artistic'}
      >
        <i className="fas fa-palette mr-2"></i>
        Artistico
        <span className="ml-2 bg-yellow-500 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded">2 CR</span>
      </button>
    </div>
  );
};