import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  X,
  Lock,
  Key,
  Mail,
  ShieldCheck,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Send,
  ArrowRight,
  Info,
} from 'lucide-react';

export default function PasswordManagerModal({
  isOpen,
  onClose,
  mode = 'reset', // 'reset' (from lock screen) or 'change' (when logged in)
  apiBaseUrl,
  onSuccess,
  showToast,
}) {
  // Current view mode: 'reset' | 'change'
  const [currentMode, setCurrentMode] = useState(mode);

  // Tabs: 'otp' | 'master' (only used in 'reset' mode)
  const [activeTab, setActiveTab] = useState('otp');

  // Form states
  const [otpCode, setOtpCode] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password visibility
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  // Status & loading
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [targetEmail, setTargetEmail] = useState('Registered Owner Email');
  const [cooldown, setCooldown] = useState(0);

  // Cooldown countdown timer
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Reset form when modal opens or mode changes
  useEffect(() => {
    if (isOpen) {
      setCurrentMode(mode);
      setErrorMsg('');
      setSuccessNotice('');
      setOtpCode('');
      setMasterPassword('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  /**
   * Request OTP dispatch strictly to surajchandan09@gmail.com
   */
  const handleRequestOtp = async () => {
    setErrorMsg('');
    setSuccessNotice('');
    setIsSendingOtp(true);

    try {
      const res = await axios.post(`${apiBaseUrl}/auth/request-otp`);
      if (res.data && res.data.success) {
        setOtpSent(true);
        setCooldown(60); // 60 seconds cooldown
        if (res.data.targetEmail) {
          setTargetEmail(res.data.targetEmail);
        }
        setSuccessNotice(
          res.data.message || `OTP code dispatched! Check your Gmail inbox at ${res.data.targetEmail || 'surajchandan09@gmail.com'}.`
        );
        showToast(res.data.isSimulated ? 'OTP code generated!' : 'OTP dispatched to your Gmail!', 'success');
      }
    } catch (err) {
      console.error('OTP request error:', err);
      const serverErr = err.response?.data?.error || err.response?.data?.details;
      setErrorMsg(serverErr || 'Failed to dispatch email. Click the "Master Admin Key" tab above to reset instantly without email.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  /**
   * Submit reset using OTP or Master Admin Password
   */
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPassword.length < 4) {
      setErrorMsg('New password must be at least 4 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirm password do not match.');
      return;
    }

    if (activeTab === 'otp') {
      if (!otpCode.trim() || otpCode.trim().length !== 6) {
        setErrorMsg('Please enter the 6-digit verification code sent to your email.');
        return;
      }
    } else if (activeTab === 'master') {
      if (!masterPassword.trim()) {
        setErrorMsg('Please enter the Master Admin Password.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload = {
        newPassword: newPassword.trim(),
        method: activeTab === 'otp' ? 'otp' : 'master_password',
        otp: activeTab === 'otp' ? otpCode.trim() : undefined,
        masterPassword: activeTab === 'master' ? masterPassword.trim() : undefined,
      };

      const res = await axios.post(`${apiBaseUrl}/auth/reset-password`, payload);

      if (res.data && res.data.success) {
        showToast('Vault password changed! All other devices logged out.', 'success');
        if (onSuccess) {
          onSuccess(res.data.message, res.data.token);
        }
        onClose();
      }
    } catch (err) {
      console.error('Password reset failed:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to reset password. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Submit change password when already logged in
   */
  const handleChangeSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!currentPassword.trim()) {
      setErrorMsg('Please enter your current vault password.');
      return;
    }

    if (newPassword.length < 4) {
      setErrorMsg('New password must be at least 4 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirm password do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await axios.post(`${apiBaseUrl}/auth/change-password`, {
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
      });

      if (res.data && res.data.success) {
        showToast('Vault password updated! All other devices logged out.', 'success');
        if (onSuccess) {
          onSuccess(res.data.message, res.data.token);
        }
        onClose();
      }
    } catch (err) {
      console.error('Password change failed:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to update password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-md my-auto bg-slate-900 border border-slate-800/90 rounded-3xl p-5 sm:p-7 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.85)] flex flex-col text-slate-100 z-10 max-h-[92dvh] overflow-y-auto no-scrollbar">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors z-20"
          title="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-3.5 pr-8">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 shrink-0">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
              {currentMode === 'reset' ? 'Reset Vault Password' : 'Change Vault Password'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {currentMode === 'reset'
                ? 'Authorize with Email OTP or Master Admin Key'
                : 'Update the daily access password for this vault'}
            </p>
          </div>
        </div>

        {/* Mode = 'reset': Tabs for OTP vs Master Admin Password */}
        {currentMode === 'reset' && (
          <div className="grid grid-cols-2 p-1 bg-slate-950 border border-slate-800 rounded-2xl mb-3 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setActiveTab('otp');
                setErrorMsg('');
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl transition-all ${
                activeTab === 'otp'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email OTP</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('master');
                setErrorMsg('');
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl transition-all ${
                activeTab === 'master'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Master Admin Key</span>
            </button>
          </div>
        )}

        {/* Compact Instant Device Logout Info Notice */}
        <div className="mb-3 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] leading-tight">
          <Info className="w-3.5 h-3.5 shrink-0 text-blue-400" />
          <span>
            <strong>Instant Logout:</strong> Changing password kicks out all other active sessions.
          </span>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="mb-3 flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successNotice && (
          <div className="mb-3 flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Form Body */}
        {currentMode === 'reset' ? (
          <form onSubmit={handleResetSubmit} className="flex flex-col gap-3">
            {activeTab === 'otp' ? (
              <>
                {/* OTP Dispatch Card */}
                <div className="p-3 bg-slate-950/80 border border-slate-800/90 rounded-2xl flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Target Email:</span>
                    <span className="font-semibold text-blue-400 font-mono text-[11px] sm:text-xs truncate max-w-[200px]">
                      {targetEmail}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={isSendingOtp || cooldown > 0}
                    className="w-full py-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                    {isSendingOtp ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending to Gmail...</span>
                      </>
                    ) : cooldown > 0 ? (
                      <span>Resend code in {cooldown}s</span>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>{otpSent ? 'Resend 6-Digit OTP' : 'Send 6-Digit OTP to Gmail'}</span>
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-slate-400 text-center">
                    Need instant access?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('master');
                        setErrorMsg('');
                      }}
                      className="text-amber-400 hover:text-amber-300 font-bold underline"
                    >
                      Use Master Admin Key
                    </button>
                  </p>
                </div>

                {/* 6-Digit Code Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      6-Digit Verification Code
                    </label>
                    {otpSent && (
                      <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Sent to Inbox
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl text-center text-xl font-mono font-bold tracking-[0.4em] text-blue-400 placeholder:text-slate-600 placeholder:tracking-widest focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner"
                  />
                </div>
              </>
            ) : (
              /* Master Admin Password Tab */
              <div className="p-3 bg-slate-950/80 border border-slate-800/90 rounded-2xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Master Admin Password
                  </label>
                  <span className="text-[10px] text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                    Zero-Email Recovery
                  </span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type={showMasterPassword ? 'text' : 'password'}
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    placeholder="Enter Master Admin Password"
                    className="w-full pl-3.5 pr-10 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMasterPassword(!showMasterPassword)}
                    className="absolute right-3 text-slate-400 hover:text-white p-1"
                  >
                    {showMasterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Permanent key configured in <code className="text-amber-400 font-mono">server/.env</code>. Resets instantly without requiring email.
                </p>
              </div>
            )}

            {/* New Password & Confirm Password Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  New Password
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 4 chars"
                    className="w-full pl-3 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2 text-slate-400 hover:text-white p-1"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 w-full py-2.5 sm:py-3 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white text-xs sm:text-sm font-bold rounded-2xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Update Password & Revoke Sessions</span>
                </>
              )}
            </button>

            {/* Switch back to current password if opened from dashboard */}
            {mode === 'change' && (
              <button
                type="button"
                onClick={() => {
                  setCurrentMode('change');
                  setErrorMsg('');
                }}
                className="text-xs text-slate-400 hover:text-slate-200 text-center py-0.5"
              >
                &larr; I know my current password
              </button>
            )}
          </form>
        ) : (
          /* Mode = 'change' (inside authenticated vault) */
          <form onSubmit={handleChangeSubmit} className="flex flex-col gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Current Vault Password
              </label>
              <div className="relative flex items-center">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 text-slate-400 hover:text-white p-1"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  New Password
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 4 chars"
                    className="w-full pl-3 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2 text-slate-400 hover:text-white p-1"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setCurrentMode('reset');
                  setActiveTab('otp');
                  setErrorMsg('');
                }}
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                Forgot password? Reset with OTP
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 w-full py-2.5 sm:py-3 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white text-xs sm:text-sm font-bold rounded-2xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Save Password & Revoke Sessions</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
