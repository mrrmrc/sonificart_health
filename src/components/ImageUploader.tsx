import React, { useState, useCallback } from 'react';
import { LegalModal } from './LegalModal';

interface ImageUploaderProps {
  onFileSelect: (file: File | null) => void;
  hasFile: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onFileSelect, hasFile }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  // Local state for Legal Modals
  const [legalModal, setLegalModal] = useState<{ isOpen: boolean, key: string, title: string }>({ isOpen: false, key: '', title: '' });

  // Compress image to prevent out-of-memory errors
  const compressImage = useCallback(async (file: File): Promise<File> => {
    const MAX_SIZE = 2048; // Max dimension in pixels
    const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB threshold
    const QUALITY = 0.85;

    // If file is small enough, skip compression
    if (file.size < MAX_FILE_SIZE) {
      return file;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        try {
          let { width, height } = img;

          // Calculate new dimensions maintaining aspect ratio
          if (width > MAX_SIZE || height > MAX_SIZE) {
            if (width > height) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            } else {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;

          if (!ctx) {
            resolve(file);
            return;
          }

          // Draw and compress
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                console.log(`Image compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            QUALITY
          );
        } catch (err) {
          console.error('Compression error:', err);
          resolve(file);
        } finally {
          // Clean up
          URL.revokeObjectURL(img.src);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        resolve(file);
      };

      img.src = URL.createObjectURL(file);
    });
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);

    // Compress large images to prevent memory issues
    const processedFile = await compressImage(file);
    onFileSelect(processedFile);
  }, [onFileSelect, compressImage]);

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

  const openLegal = (e: React.MouseEvent, key: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();
    setLegalModal({ isOpen: true, key, title });
  };

  // RENDER ALREADY SELECTED FILE
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

  // RENDER UPLOAD ZONE
  return (
    <div className="w-full">
      <label
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`flex flex-col justify-center items-center w-full h-48 px-4 transition-all duration-300 bg-black/20 border-2 ${isDragging ? 'border-brand-accent bg-brand-accent/5 scale-[1.02] shadow-[0_0_15px_rgba(45,212,191,0.1)]' : 'border-dashed border-white/10 hover:border-brand-accent/50 hover:bg-white/5'} rounded-xl appearance-none cursor-pointer focus:outline-none group relative`}
      >
        <div className="w-14 h-14 rounded-full bg-white/5 group-hover:bg-brand-accent/10 flex items-center justify-center mb-4 text-brand-text-secondary group-hover:text-brand-accent transition-colors">
          <i className="fas fa-cloud-upload-alt text-2xl"></i>
        </div>
        <span className="font-medium text-white text-center mb-1">
          Trascina un'immagine o <span className="text-brand-accent underline">cerca</span>
        </span>
        <span className="text-xs text-brand-text-secondary text-center opacity-70 mb-2">
          Supporta file immagine (JPG, PNG, WEBP)
        </span>
        <input type="file" name="file_upload" className="hidden" accept="image/*" onChange={handleFileChange} />
      </label>

      {/* Legal Disclaimers */}
      <div className="mt-2 flex justify-center gap-4 text-[10px] text-gray-500">
        <button onClick={(e) => openLegal(e, 'image_upload_policy', 'Informativa Upload')} className="hover:text-brand-accent underline decoration-brand-accent/30 hover:decoration-brand-accent transition-colors flex items-center gap-1">
          <i className="fas fa-info-circle"></i> Info Upload
        </button>
        <button onClick={(e) => openLegal(e, 'upload_disclaimer', 'Disclaimer Legale')} className="hover:text-brand-accent underline decoration-brand-accent/30 hover:decoration-brand-accent transition-colors flex items-center gap-1">
          <i className="fas fa-exclamation-triangle"></i> Disclaimer
        </button>
      </div>

      <LegalModal
        isOpen={legalModal.isOpen}
        onClose={() => setLegalModal({ ...legalModal, isOpen: false })}
        documentKey={legalModal.key}
        title={legalModal.title}
      />
    </div>
  );
};
