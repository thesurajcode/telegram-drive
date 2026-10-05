import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff, Wifi, RefreshCw, X, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function OfflineBanner({ onRetryConnection }) {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showReconnected, setShowReconnected] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // Periodic heartbeat / connectivity check when offline
  const checkConnectivity = useCallback(async () => {
    setIsChecking(true);
    try {
      // Try to fetch a lightweight timestamp or standard health check with cache busting
      const response = await fetch(`${window.location.origin}/?_t=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        mode: 'no-cors',
      });
      // If fetch doesn't throw, we are back online
      setIsOnline(true);
      setIsDismissed(false);
      setShowReconnected(true);
      if (onRetryConnection) onRetryConnection();
      setTimeout(() => setShowReconnected(false), 4000);
    } catch {
      // Still offline
      setIsOnline(false);
    } finally {
      setIsChecking(false);
    }
  }, [onRetryConnection]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsDismissed(false);
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsDismissed(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // If initial load starts offline, check periodically
    let intervalId;
    if (!isOnline) {
      intervalId = setInterval(() => {
        checkConnectivity();
      }, 15000);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (intervalId) clearInterval(intervalId);
    };
  }, [isOnline, checkConnectivity]);

  // If online and not showing the restored toast, or if user dismissed, do not render
  if ((isOnline && !showReconnected) || (isDismissed && !showReconnected)) {
    return null;
  }

  return (
    <aside
      role="alert"
      aria-live="polite"
      style={{
        top: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 16px)',
      }}
      className="fixed left-1/2 -translate-x-1/2 z-[9999] w-[94%] max-w-md pointer-events-none transition-all duration-300 ease-out animate-in slide-in-from-top-4 fade-in"
    >
      {!isOnline ? (
        /* OFFLINE BANNER - High contrast, notch-safe, responsive */
        <div className="pointer-events-auto relative overflow-hidden bg-slate-950/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-amber-500/50 rounded-2xl p-3.5 sm:p-4 shadow-[0_16px_40px_-6px_rgba(245,158,11,0.4)] flex items-center justify-between gap-3 text-slate-100 ring-1 ring-amber-400/20">
          {/* Subtle glowing ambient line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent pointer-events-none" />

          {/* Left: Icon & Text */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <WifiOff className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tracking-tight text-amber-300 uppercase">
                  Offline Mode
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              </div>
              <p className="text-[12px] text-slate-300 font-medium truncate leading-tight">
                Cached vault files active & ready.
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={checkConnectivity}
              disabled={isChecking}
              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 border border-amber-400/40 rounded-xl text-amber-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
              title="Test connection"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Checking...' : 'Retry'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Dismiss banner"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : showReconnected ? (
        /* RECONNECTED BANNER */
        <div className="pointer-events-auto relative overflow-hidden bg-slate-950/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-emerald-500/50 rounded-2xl p-3.5 sm:p-4 shadow-[0_16px_40px_-6px_rgba(16,185,129,0.4)] flex items-center justify-between gap-3 text-slate-100 ring-1 ring-emerald-400/20">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent pointer-events-none" />

          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold tracking-tight text-emerald-300 uppercase">
                Back Online
              </span>
              <p className="text-[12px] text-slate-300 font-medium truncate leading-tight">
                Connection restored to Telegram Cloud.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowReconnected(false)}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-white/10 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Dismiss notification"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : null}
    </aside>
  );
}
