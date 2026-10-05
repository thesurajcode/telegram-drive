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
          `OTP code dispatched! Check your Gmail inbox at ${res.data.targetEmail || 'surajchandan09@gmail.com'}.`
        );
        showToast('OTP code dispatched to your Gmail!', 'success');
      }
    } catch (err) {
      console.error('OTP request error:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to send OTP. Please try again shortly.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-black flex flex-col text-slate-100 z-10 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 shrink-0">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              {currentMode === 'reset' ? 'Reset Vault Password' : 'Change Vault Password'}
            </h3>
            <p className="text-xs text-slate-400">
              {currentMode === 'reset'
                ? 'Authorize with Email OTP or Master Admin Key'
                : 'Update the daily access password for this vault'}
            </p>
          </div>
        </div>

        {/* Mode = 'reset': Tabs for OTP vs Master Admin Password */}
        {currentMode === 'reset' && (
          <div className="grid grid-cols-2 p-1 bg-slate-950 border border-slate-800 rounded-2xl mb-4 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveTab('otp');
                setErrorMsg('');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl transition-all ${
                activeTab === 'otp'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
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
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl transition-all ${
                activeTab === 'master'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Master Admin Key</span>
            </button>
          </div>
        )}

        {/* Global Session Revocation Info Notice */}
        <div className="mb-4 flex items-start gap-2 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] leading-tight">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
          <span>
            <strong>Instant Device Logout:</strong> Changing your password will immediately revoke access and kick out all other logged-in devices (including shared sessions).
          </span>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successNotice && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Form Body */}
        {currentMode === 'reset' ? (
          <form onSubmit={handleResetSubmit} className="flex flex-col gap-3.5">
            {activeTab === 'otp' ? (
              <>
                {/* OTP Dispatch Section */}
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Target Email:</span>
                    <span className="font-semibold text-blue-400 font-mono">
                      {targetEmail}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={isSendingOtp || cooldown > 0}
                    className="w-full mt-1 py-2 px-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSendingOtp ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Dispatching to Gmail...</span>
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
                </div>

                {/* 6-Digit Code Input */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit OTP"
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-center text-lg font-mono tracking-widest text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </>
            ) : (
              /* Master Admin Password Tab */
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Master Admin Password (Recovery Key)
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showMasterPassword ? 'text' : 'password'}
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    placeholder="Enter MASTER_ADMIN_PASSWORD"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMasterPassword(!showMasterPassword)}
                    className="absolute right-3 text-slate-500 hover:text-slate-300"
                  >
                    {showMasterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Permanent key configured in server/.env
                </p>
              </div>
            )}

            {/* New Password Input */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                New Vault Password
              </label>
              <div className="relative flex items-center">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 4 characters"
                  className="w-full pl-3.5 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 text-slate-500 hover:text-slate-300"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold rounded-2xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Update Password & Kick Out Other Devices</span>
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
                className="text-xs text-slate-400 hover:text-slate-200 text-center mt-1 py-1"
              >
                &larr; I know my current password
              </button>
            )}
          </form>
        ) : (
          /* Mode = 'change' (inside authenticated vault) */
          <form onSubmit={handleChangeSubmit} className="flex flex-col gap-3.5">
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
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 text-slate-500 hover:text-slate-300"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                New Vault Password
              </label>
              <div className="relative flex items-center">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 4 characters"
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 text-slate-500 hover:text-slate-300"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => {
                  setCurrentMode('reset');
                  setActiveTab('otp');
                  setErrorMsg('');
                }}
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                Forgot current password? Reset with OTP
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold rounded-2xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Save New Password & Kick Out Other Devices</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
