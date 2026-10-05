import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

/**
 * Premium, Safe-Area-Aware Toast Notification Component
 * Smooth spring entrance, responsive contrast, auto-dismiss, and manual close.
 */
export default function Toast({ toast, onClose }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!toast) {
      setProgress(100);
      return;
    }

    const duration = toast.duration || 4500;
    const interval = 40;
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          if (onClose) onClose();
          return 0;
        }
        return prev - step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [toast, onClose]);

  if (!toast || !toast.message) return null;

  const type = toast.type || 'info';

  const typeStyles = {
    success: {
      border: 'border-emerald-500/50 dark:border-emerald-500/40',
      bg: 'bg-slate-950/95 dark:bg-slate-900/95',
      shadow: 'shadow-[0_12px_36px_-6px_rgba(16,185,129,0.35)]',
      glow: 'from-transparent via-emerald-400 to-transparent',
      bar: 'bg-emerald-400',
      iconBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
      title: 'text-emerald-400',
      icon: CheckCircle,
    },
    error: {
      border: 'border-rose-500/50 dark:border-rose-500/40',
      bg: 'bg-slate-950/95 dark:bg-slate-900/95',
      shadow: 'shadow-[0_12px_36px_-6px_rgba(244,63,94,0.35)]',
      glow: 'from-transparent via-rose-400 to-transparent',
      bar: 'bg-rose-500',
      iconBg: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
      title: 'text-rose-400',
      icon: AlertCircle,
    },
    warning: {
      border: 'border-amber-500/50 dark:border-amber-500/40',
      bg: 'bg-slate-950/95 dark:bg-slate-900/95',
      shadow: 'shadow-[0_12px_36px_-6px_rgba(245,158,11,0.35)]',
      glow: 'from-transparent via-amber-400 to-transparent',
      bar: 'bg-amber-400',
      iconBg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
      title: 'text-amber-400',
      icon: AlertTriangle,
    },
    info: {
      border: 'border-blue-500/50 dark:border-blue-500/40',
      bg: 'bg-slate-950/95 dark:bg-slate-900/95',
      shadow: 'shadow-[0_12px_36px_-6px_rgba(59,130,246,0.35)]',
      glow: 'from-transparent via-blue-400 to-transparent',
      bar: 'bg-blue-400',
      iconBg: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
      title: 'text-blue-400',
      icon: Info,
    },
  };

  const current = typeStyles[type] || typeStyles.info;
  const IconComponent = current.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        bottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 20px), 24px)',
      }}
      className="fixed left-1/2 -translate-x-1/2 z-[9999] w-[92%] max-w-sm pointer-events-none transition-all duration-300 ease-out animate-in slide-in-from-bottom-5 fade-in"
    >
      <div
        className={`pointer-events-auto relative overflow-hidden ${current.bg} ${current.border} ${current.shadow} backdrop-blur-2xl rounded-2xl p-3.5 sm:p-4 border text-slate-100 flex flex-col gap-2.5`}
      >
        {/* Ambient Top Glow Line */}
        <div
          className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${current.glow} pointer-events-none`}
        />

        {/* Content Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 shadow-inner ${current.iconBg}`}
            >
              <IconComponent className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${current.title}`}>
                {type === 'error' ? 'Notice' : type === 'success' ? 'Success' : 'Information'}
              </span>
              <p className="text-xs font-medium text-slate-200 break-words leading-snug">
                {toast.message}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0 cursor-pointer"
            aria-label="Close notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic Countdown Progress Bar */}
        <div className="w-full bg-slate-800/80 rounded-full h-[2.5px] overflow-hidden">
          <div
            className={`h-full ${current.bar} transition-all duration-75 ease-linear rounded-full`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
