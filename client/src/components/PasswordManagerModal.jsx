import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  X,
  Key,
  Mail,
  ShieldCheck,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Send,
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
  const [targetEmail, setTargetEmail] = useState('');
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
   * Request OTP dispatch strictly to registered email
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
        setSuccessNotice('OTP code sent to your Gmail inbox.');
        showToast(res.data.isSimulated ? 'OTP code generated!' : 'OTP dispatched to your Gmail!', 'success');
      }
    } catch (err) {
      console.error('OTP request error:', err);
      const serverErr = err.response?.data?.error || err.response?.data?.details;
      setErrorMsg(serverErr || 'Failed to dispatch email. Switch to Master Admin Key tab to reset without email.');
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
        setErrorMsg('Please enter the 6-digit verification code.');
        return;
      }
    } else if (activeTab === 'master') {
      if (!masterPassword.trim()) {
        setErrorMsg('Please enter the Master Admin Key.');
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
        showToast('Password changed! All other sessions revoked.', 'success');
        if (onSuccess) {
          onSuccess(res.data.message, res.data.token);
        }
        onClose();
      }
    } catch (err) {
      console.error('Password reset failed:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to reset password. Check your credentials.');
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
      setErrorMsg('Please enter your current password.');
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
        showToast('Password updated! All other sessions revoked.', 'success');
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
    <div
      role="dialog"
      aria-modal="true"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px) + 16px, 16px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 16px, 16px)',
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto"
    >
      <div className="relative w-full max-w-sm sm:max-w-md my-auto bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col text-slate-100 z-10 max-h-[min(90vh,calc(100dvh-3rem))] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors z-20"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2.5 mb-3 pr-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25 shrink-0">
            <Key className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white tracking-tight truncate">
              {currentMode === 'reset' ? 'Reset Vault Password' : 'Change Vault Password'}
            </h3>
            <p className="text-[11px] text-slate-400 truncate">
              {currentMode === 'reset'
                ? 'Verify with Email OTP or Master Admin Key'
                : 'Update your daily vault access password'}
            </p>
          </div>
        </div>

        {/* Reset Mode Tabs: Clean, Compact Segmented Control */}
        {currentMode === 'reset' && (
          <div className="grid grid-cols-2 p-0.5 bg-slate-950 border border-slate-800 rounded-xl mb-3 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveTab('otp');
                setErrorMsg('');
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg transition-all ${
                activeTab === 'otp'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
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
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg transition-all ${
                activeTab === 'master'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Master Key</span>
            </button>
          </div>
        )}

        {/* Error / Success Feedback */}
        {errorMsg && (
          <div className="mb-2.5 flex flex-col gap-1 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-tight">{errorMsg}</span>
            </div>
            {currentMode === 'reset' && activeTab === 'otp' && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('master');
                  setErrorMsg('');
                }}
                className="mt-1 text-left text-[11px] font-bold text-amber-400 hover:text-amber-300 underline"
              >
                &rarr; Switch to Master Key tab (Reset immediately without email)
              </button>
            )}
          </div>
        )}

        {successNotice && (
          <div className="mb-2.5 flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span className="leading-tight">{successNotice}</span>
          </div>
        )}

        {/* Form Body */}
        {currentMode === 'reset' ? (
          <form onSubmit={handleResetSubmit} className="flex flex-col gap-2.5">
            {activeTab === 'otp' ? (
              <div className="flex flex-col gap-2.5">
                {/* Send OTP Action Card */}
                {!otpSent ? (
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 flex flex-col gap-2">
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Click below to send a 6-digit one-time code to your registered Gmail account.
                    </p>
                    <button
                      type="button"
                      onClick={handleRequestOtp}
                      disabled={isSendingOtp}
                      className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs font-bold rounded-lg shadow transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSendingOtp ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Dispatching OTP to Gmail...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Send 6-Digit OTP to Gmail</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      <span className="text-[11px] font-medium truncate max-w-[200px]">
                        Sent to {targetEmail || 'Gmail'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRequestOtp}
                      disabled={isSendingOtp || cooldown > 0}
                      className="text-blue-400 hover:text-blue-300 text-[11px] font-bold disabled:opacity-50"
                    >
                      {cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend Code'}
                    </button>
                  </div>
                )}

                {/* 6-Digit Code Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Enter 6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full h-11 px-3 bg-slate-950 border border-slate-800 rounded-xl text-center text-xl font-mono font-black tracking-[0.35em] text-blue-400 placeholder:text-slate-600 placeholder:tracking-normal placeholder:font-normal placeholder:text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all shadow-inner"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Master Admin Key
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showMasterPassword ? 'text' : 'password'}
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    placeholder="Enter Master Admin Key"
                    className="w-full h-10 pl-3 pr-9 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMasterPassword(!showMasterPassword)}
                    className="absolute right-2.5 text-slate-400 hover:text-white p-1"
                    tabIndex={-1}
                  >
                    {showMasterPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Instant recovery key configured on server. No email needed.
                </p>
              </div>
            )}

            {/* New Password & Confirm Password Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-0.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  New Password
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 4 chars"
                    className="w-full h-9 pl-2.5 pr-8 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2 text-slate-400 hover:text-white p-0.5"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter"
                  className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1.5 w-full h-10 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Update Password</span>
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
                &larr; Back to change password
              </button>
            )}
          </form>
        ) : (
          /* Mode = 'change' (inside authenticated vault) */
          <form onSubmit={handleChangeSubmit} className="flex flex-col gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Current Password
              </label>
              <div className="relative flex items-center">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full h-10 pl-3 pr-9 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-2.5 text-slate-400 hover:text-white p-1"
                  tabIndex={-1}
                >
                  {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  New Password
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 4 chars"
                    className="w-full h-9 pl-2.5 pr-8 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2 text-slate-400 hover:text-white p-0.5"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter"
                  className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
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
              className="mt-1 w-full h-10 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Update Password</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
