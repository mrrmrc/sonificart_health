
import React, { useState, useCallback } from 'react';

interface ImageUploaderProps {
  onFileSelect: (file: File | null) => void;
  hasFile: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onFileSelect, hasFile }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    onFileSelect(file);
  }, [onFileSelect]);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
  const handleDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.stopPropagation(); }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFileName(null);
    onFileSelect(null);
  };

  if (hasFile && fileName) {
    return (
      <div className="flex justify-center items-center w-full h-24 px-4 transition bg-emerald-900/20 border border-emerald-500/30 rounded-xl backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
             <i className="fas fa-check"></i>
          </div>
          <div className="flex flex-col">
              <span className="font-bold text-white text-sm truncate max-w-[200px]">{fileName}</span>
              <span className="text-xs text-brand-text-secondary">Pronto per l'analisi</span>
          </div>
          <button onClick={handleRemoveFile} className="ml-4 text-white/50 hover:text-red-400 transition-colors">
            <i className="fas fa-times-circle text-xl"></i>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <label
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`flex flex-col justify-center items-center w-full h-48 px-4 transition-all duration-300 bg-black/20 border-2 ${isDragging ? 'border-brand-accent bg-brand-accent/5 scale-[1.02] shadow-[0_0_15px_rgba(45,212,191,0.1)]' : 'border-dashed border-white/10 hover:border-brand-accent/50 hover:bg-white/5'} rounded-xl appearance-none cursor-pointer focus:outline-none group`}
      >
        <div className="w-14 h-14 rounded-full bg-white/5 group-hover:bg-brand-accent/10 flex items-center justify-center mb-4 text-brand-text-secondary group-hover:text-brand-accent transition-colors">
            <i className="fas fa-cloud-upload-alt text-2xl"></i>
        </div>
        <span className="font-medium text-white text-center mb-1">
            Trascina un'immagine o <span className="text-brand-accent underline">cerca</span>
        </span>
        <span className="text-xs text-brand-text-secondary text-center opacity-70">
            Supporta file immagine (JPG, PNG, WEBP)
        </span>
        <input type="file" name="file_upload" className="hidden" accept="image/*" onChange={handleFileChange} />
      </label>
    </div>
  );
};
