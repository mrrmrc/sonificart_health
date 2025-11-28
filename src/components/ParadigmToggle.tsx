import React from 'react';
import { Paradigm } from '../types';

interface ParadigmToggleProps {
  selectedParadigm: Paradigm;
  onParadigmChange: (paradigm: Paradigm) => void;
  isUnlimited?: boolean; // Nuova prop opzionale
}

export const ParadigmToggle: React.FC<ParadigmToggleProps> = ({ selectedParadigm, onParadigmChange, isUnlimited = false }) => {
  const getButtonClass = (paradigm: Paradigm) => {
    const base = "w-full py-2 px-4 text-sm font-bold rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-secondary flex items-center justify-center";
    if (paradigm === selectedParadigm) {
      return `${base} bg-brand-accent text-brand-primary shadow-lg`;
    }
    return `${base} bg-brand-primary/50 text-brand-text-secondary hover:bg-brand-secondary/70`;
  };

  // Helper per mostrare il costo o l'icona
  const renderCostBadge = (cost: number) => {
    if (isUnlimited) return null; // Nascondi costo se illimitato
    return (
      <span className="ml-2 bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
        {cost} CR
      </span>
    );
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
        {renderCostBadge(1)}
      </button>
      <button
        onClick={() => onParadigmChange('hybrid')}
        className={getButtonClass('hybrid')}
        aria-pressed={selectedParadigm === 'hybrid'}
      >
        <i className="fas fa-layer-group mr-2"></i>
        Ibrido
        {renderCostBadge(2)}
      </button>
      <button
        onClick={() => onParadigmChange('artistic')}
        className={getButtonClass('artistic')}
        aria-pressed={selectedParadigm === 'artistic'}
      >
        <i className="fas fa-palette mr-2"></i>
        Artistico
        {renderCostBadge(2)}
      </button>
    </div>
  );
};