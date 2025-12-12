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
    const activeStepAnimRef = useRef<number | null>(null);
    const [activeStepProgress, setActiveStepProgress] = useState(0); // 0..1 progresso interno dello step attivo

    // The "target" percentage based on discrete step completion
    const progressPercentage = useMemo(() => {
        const completedSteps = steps.filter(s => s.status === 'completed').length;
        const totalSteps = steps.length;
        if (totalSteps === 0) return 0;

        const isFinished = completedSteps === totalSteps && !steps.some(s => s.status === 'active');
        if (isFinished) return 100;

        // Usa il progresso interno dello step attivo per rendere la % dinamica
        const activeIndex = steps.findIndex(s => s.status === 'active');
        const stepFraction = activeIndex >= 0 ? activeStepProgress : 0;
        const progress = (completedSteps + stepFraction) / totalSteps;
        // Evita di mostrare 100% finché non è tutto terminato
        return Math.min(99, Math.max(0, progress * 100));
    }, [steps, activeStepProgress]);

    // Anima il progresso dello step attivo (0 -> 0.95) finché non cambia lo status
    useEffect(() => {
        const activeIndex = steps.findIndex(s => s.status === 'active');
        if (activeIndex === -1) {
            setActiveStepProgress(0);
            if (activeStepAnimRef.current !== null) cancelAnimationFrame(activeStepAnimRef.current);
            return;
        }

        // Reset quando cambia lo step attivo
        setActiveStepProgress(0);
        if (activeStepAnimRef.current !== null) cancelAnimationFrame(activeStepAnimRef.current);

        const tick = () => {
            setActiveStepProgress(prev => {
                // Cresce lentamente verso 0.95, mai 1.0 finché non viene marcato completed
                if (prev >= 0.95) return 0.95;
                return prev + 0.004; // ~0.4% per frame ~25s per step; viene azzerato quando step termina
            });
            activeStepAnimRef.current = requestAnimationFrame(tick);
        };
        activeStepAnimRef.current = requestAnimationFrame(tick);

        return () => {
            if (activeStepAnimRef.current !== null) cancelAnimationFrame(activeStepAnimRef.current);
        };
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

    // Calcola la percentuale per ogni step individuale
    const getStepPercentage = (step: ProcessingStep, index: number) => {
        if (step.status === 'completed') return 100;
        if (step.status === 'pending') return 0;

        // Step attivo: usa la progressione animata (0..95%)
        const activeIndex = steps.findIndex(s => s.status === 'active');
        if (activeIndex === index) {
            return Math.round(activeStepProgress * 100);
        }
        return 0;
    };

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
                    <div className="text-3xl font-mono font-bold text-brand-accent mt-3">{Math.round(visualProgress)}%</div>
                    <h3 className="text-2xl font-bold text-white mt-2">Framework v1.0 in Elaborazione</h3>
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
                        {steps.map((step, index) => {
                            const stepPercentage = getStepPercentage(step, index);
                            return (
                                <div key={step.id} className={`flex items-center gap-4 p-3 rounded-md transition-all duration-300 ${getStepClass(step.status)}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${getIconClass(step.status)}`}>
                                        {step.status === 'completed' ? <i className="fas fa-check"></i> : step.id}
                                    </div>
                                    <div className="flex-grow">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-brand-text-primary text-sm">{step.name}</span>
                                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                                                step.status === 'completed'
                                                    ? 'text-green-200 border-green-400/60 bg-green-500/10'
                                                    : step.status === 'active'
                                                        ? 'text-brand-accent border-brand-accent/60 bg-brand-accent/10'
                                                        : 'text-brand-text-secondary border-white/10 bg-white/5'
                                            }`}>
                                                {Math.round(stepPercentage)}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-brand-primary/50 rounded-full h-1.5">
                                            <div
                                                className={`h-full rounded-full transition-all duration-300 ${step.status === 'completed' ? 'bg-green-500' :
                                                        step.status === 'active' ? 'bg-brand-accent' :
                                                            'bg-brand-secondary'
                                                    }`}
                                                style={{ width: `${stepPercentage}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
