import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ProcessingStep } from '../types';

interface ProcessingViewProps {
    steps: ProcessingStep[];
    imageUrl: string | null;
}

export const ProcessingView: React.FC<ProcessingViewProps> = ({ steps, imageUrl }) => {
    const [visualProgress, setVisualProgress] = useState(0);
    // FIX: Initialize useRef with null to satisfy environments where an initial value is required, and to correctly handle type checks.
    const animationFrameRef = useRef<number | null>(null);

    // The "target" percentage based on discrete step completion
    const progressPercentage = useMemo(() => {
        const completedSteps = steps.filter(s => s.status === 'completed').length;
        const totalSteps = steps.length;
        if (totalSteps === 0) return 0;

        const isFinished = completedSteps === totalSteps && !steps.some(s => s.status === 'active');
        if (isFinished) return 100;

        // Give a little progress for the active step to feel more responsive
        const activeStep = steps.find(s => s.status === 'active');
        const progress = activeStep ? (completedSteps + 0.5) / totalSteps : completedSteps / totalSteps;
        return Math.min(100, progress * 100);
    }, [steps]);

    const isFinalStepActive = useMemo(() =>
        steps.length > 0 && steps[steps.length - 1].status === 'active',
        [steps]);

    const finalStepName = useMemo(() => steps.length > 0 ? steps[steps.length - 1].name : '', [steps]);

    useEffect(() => {
        const animate = () => {
            if (isFinalStepActive) {
                // When final step is active, ignore `progressPercentage` and creep towards 99
                setVisualProgress(current => {
                    if (current >= 99) return 99;
                    const increment = (99 - current) * 0.01; // Creep slows as it nears 99
                    return current + increment;
                });
            } else {
                // For all other steps, smoothly move towards the calculated percentage
                setVisualProgress(current => {
                    if (Math.abs(current - progressPercentage) < 0.1) {
                        if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
                        return progressPercentage;
                    }
                    // Simple easing function
                    return current + (progressPercentage - current) * 0.1;
                });
            }
            animationFrameRef.current = requestAnimationFrame(animate);
        };

        // Cancel previous animation frame before starting a new one
        if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [progressPercentage, isFinalStepActive]);


    const getStepClass = (status: string) => {
        switch (status) {
            case 'active':
                return 'border-l-4 border-brand-accent bg-brand-accent/20';
            case 'completed':
                return 'border-l-4 border-green-500 bg-green-500/20';
            default:
                return 'border-l-4 border-brand-secondary bg-brand-primary/50';
        }
    };

    const getIconClass = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-brand-accent animate-pulse';
            case 'completed':
                return 'bg-green-500';
            default:
                return 'bg-brand-secondary';
        }
    }

    return (
        <div className="max-w-2xl mx-auto my-8 animate-fade-in">
            <div className="relative rounded-lg overflow-hidden border border-brand-secondary/50 shadow-2xl">
                {imageUrl && (
                    <div
                        className="absolute inset-0 bg-cover bg-center blur-lg scale-110 opacity-25"
                        style={{ backgroundImage: `url(${imageUrl})` }}
                    />
                )}

                <div className="relative p-6 text-center bg-brand-secondary/80 backdrop-blur-md">
                    <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-brand-accent mx-auto"></div>
                    <h3 className="text-2xl font-bold text-white mt-4">Framework v1.0 in Elaborazione</h3>
                    {isFinalStepActive ? (
                        <p className="text-brand-accent-light min-h-[40px] flex flex-col items-center justify-center text-center">
                            <span>{finalStepName}...</span>
                            <span className="text-xs">(questa operazione potrebbe richiedere più tempo)</span>
                        </p>
                    ) : (
                        <p className="text-brand-text-secondary min-h-[40px] flex items-center justify-center">
                            Eseguendo algoritmi con garanzie bit-perfect...
                        </p>
                    )}


                    <div className="mt-6 text-left">
                        <div className="flex justify-between items-center mb-1">
                            <h4 className="text-sm font-bold text-white">Avanzamento</h4>
                            <span className="text-sm font-mono text-brand-accent-light">{Math.round(visualProgress)}%</span>
                        </div>
                        <div className="w-full bg-brand-primary/70 rounded-full h-2.5 border border-brand-secondary/50">
                            <div
                                className="bg-brand-accent h-2 rounded-full transition-all duration-150 ease-linear"
                                style={{ width: `${visualProgress}%` }}
                            />
                        </div>
                    </div>

                    <div className="mt-4 text-left space-y-2">
                        {steps.map(step => (
                            <div key={step.id} className={`flex items-center gap-4 p-3 rounded-md transition-all duration-300 ${getStepClass(step.status)}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${getIconClass(step.status)}`}>
                                    {step.status === 'completed' ? <i className="fas fa-check"></i> : step.id}
                                </div>
                                <span className="text-brand-text-primary">{step.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
