import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info, CheckCircle2, Target, Hand, Fingerprint, Trash2 } from 'lucide-react';
import { Task } from '../types';
import { cn } from '../lib/utils';

interface GuidancePanelProps {
  task: Task | null;
}

const GESTURE_ICONS = {
  discovery: ({ className }: { className?: string }) => (
    <div className={cn("flex items-center justify-center", className)}>
      <span className="text-4xl leading-none select-none">👆</span>
    </div>
  ),
  feeding: ({ className }: { className?: string }) => (
    <div className={cn("flex items-center justify-center", className)}>
      <span className="text-4xl leading-none select-none">🫰</span>
    </div>
  ),
  cleanup: ({ className }: { className?: string }) => (
    <div className={cn("flex items-center justify-center", className)}>
      <span className="text-4xl leading-none select-none">✊</span>
    </div>
  ),
};

export default function GuidancePanel({ task }: GuidancePanelProps) {
  if (!task) return null;

  const progress = (task.currentCount / task.targetCount) * 100;
  const GestureIcon = GESTURE_ICONS[task.type];

  return (
    <div className="absolute top-6 left-6 z-50 pointer-events-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={task.id}
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -100, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 100 }}
          className="bg-black/50 backdrop-blur-xl border border-white/30 rounded-3xl p-6 w-96 shadow-2xl pointer-events-auto relative"
        >
        {/* Gesture Icon in Top Right */}
        <div className="absolute top-6 right-6 p-3 bg-white/10 rounded-2xl border border-white/20">
          <GestureIcon className="w-8 h-8 text-yellow-400" />
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-blue-500/30 rounded-xl">
            <Target className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-white font-black text-3xl leading-tight tracking-tight">{task.title}</h3>
            <p className="text-blue-400 text-sm uppercase tracking-widest font-bold">当前任务</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
            <p className="text-white text-lg leading-relaxed font-medium">
              {task.description}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <span className="text-white/70 text-sm font-bold uppercase tracking-wider">任务进度</span>
              <span className="text-white font-mono text-xl font-bold">
                {task.currentCount} <span className="text-white/40 text-sm">/</span> {task.targetCount}
              </span>
            </div>
            
            <div className="h-3 bg-white/10 rounded-full overflow-hidden border border-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className={cn(
                  "h-full rounded-full transition-colors duration-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]",
                  task.completed ? "bg-green-400 shadow-green-400/50" : "bg-blue-400 shadow-blue-400/50"
                )}
              />
            </div>
          </div>

          <AnimatePresence>
            {task.completed && (
              <motion.div
                initial={{ height: 0, opacity: 0, scale: 0.9 }}
                animate={{ height: 'auto', opacity: 1, scale: 1 }}
                exit={{ height: 0, opacity: 0, scale: 0.9 }}
                className="flex items-center gap-3 text-green-400 bg-green-400/20 rounded-xl p-3 border border-green-400/30"
              >
                <CheckCircle2 className="w-6 h-6" />
                <span className="text-sm font-black uppercase tracking-wide">任务已完成！太棒了！</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  </div>
);
}
