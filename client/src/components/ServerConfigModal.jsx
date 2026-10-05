import React, { useState } from 'react';
import { Server, Check, X, Globe, RefreshCw, AlertCircle } from 'lucide-react';
import axios from 'axios';

export default function ServerConfigModal({
  isOpen,
  onClose,
  currentUrl,
  onSave,
  showToast,
}) {
  const [urlInput, setUrlInput] = useState(currentUrl || '');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: boolean, message: string }

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!urlInput.trim()) {
      setTestResult({ success: false, message: 'Please enter a server URL.' });
      return;
    }

    let cleanUrl = urlInput.trim().replace(/\/+$/, '');
    if (!cleanUrl.endsWith('/api') && !cleanUrl.includes('/api/')) {
      // If user typed http://192.168.1.5:3001, append /api
      cleanUrl = `${cleanUrl}/api`;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      // Test root or status endpoint
      const testEndpoint = cleanUrl.replace(/\/api$/, '') || cleanUrl;
      const res = await axios.get(testEndpoint, { timeout: 6000 });
      if (res.status === 200) {
        setTestResult({
          success: true,
          message: 'Connected successfully to backend server!',
        });
      } else {
        setTestResult({
          success: true,
          message: `Server responded with HTTP ${res.status}`,
        });
      }
    } catch (err) {
      console.warn('Connection test error:', err);
      setTestResult({
        success: false,
        message: err.message.includes('timeout')
          ? 'Connection timed out. Verify your IP and port.'
          : `Could not reach server: ${err.message}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    let cleanUrl = urlInput.trim().replace(/\/+$/, '');
    if (!cleanUrl) {
      setTestResult({ success: false, message: 'URL cannot be empty.' });
      return;
    }

    if (!cleanUrl.endsWith('/api') && !cleanUrl.includes('/api/')) {
      cleanUrl = `${cleanUrl}/api`;
    }

    onSave(cleanUrl);
    if (showToast) showToast('Backend Server URL updated!', 'success');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px) + 16px, 16px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 16px, 16px)',
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className="relative w-full max-w-sm sm:max-w-md max-h-[min(90vh,calc(100dvh-3rem))] overflow-y-auto my-auto bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl z-10 animate-in zoom-in-95 duration-200 text-slate-100 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4 pr-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25 shrink-0">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Backend Server URL
            </h3>
            <p className="text-[11px] text-slate-400">
              Configure backend endpoint for phone or local network
            </p>
          </div>
        </div>

        {/* Input */}
        <div className="flex flex-col gap-2 mb-3">
          <label className="text-xs font-semibold text-slate-300">
            Server API Endpoint
          </label>
          <div className="relative flex items-center">
            <Globe className="w-4 h-4 absolute left-3 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                if (testResult) setTestResult(null);
              }}
              placeholder="e.g. https://your-app.onrender.com/api"
              className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
          <p className="text-[11px] text-slate-500">
            If testing locally on Wi-Fi, use your PC's IP (e.g. <span className="font-mono text-slate-400">http://192.168.1.15:3001/api</span>).
          </p>
        </div>

        {/* Test Result Feedback */}
        {testResult && (
          <div
            className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 mb-3 ${
              testResult.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            {testResult.success ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 mt-1">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="py-2 px-3 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save & Apply</span>
          </button>
        </div>
      </div>
    </div>
  );
}
