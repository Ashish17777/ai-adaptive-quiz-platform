import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, RefreshCw, X, ShieldCheck } from 'lucide-react';
import API from '../services/api';

interface OTPVerificationModalProps {
  email: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (userData: any) => void;
}

const OTPVerificationModal: React.FC<OTPVerificationModalProps> = ({
  email,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Auto-focus first input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => firstInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const clearAndRefocus = () => {
    setOtp(['', '', '', '', '', '']);
    setTimeout(() => firstInputRef.current?.focus(), 50);
  };

  const handleOtpChange = (element: HTMLInputElement, index: number) => {
    if (isNaN(Number(element.value))) return false;

    const newOtp = [...otp];
    newOtp[index] = element.value;
    setOtp(newOtp);

    if (element.value && element.nextElementSibling) {
      (element.nextElementSibling as HTMLInputElement).focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const inputs = document.querySelectorAll<HTMLInputElement>('.otp-input-field');
      if (inputs[index - 1]) inputs[index - 1].focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newOtp = ['', '', '', '', '', ''];
    pasted.split('').forEach((char, i) => { newOtp[i] = char; });
    setOtp(newOtp);

    // Focus the last filled box (or last box if all 6 filled)
    const inputs = document.querySelectorAll<HTMLInputElement>('.otp-input-field');
    const focusIndex = Math.min(pasted.length, 5);
    setTimeout(() => inputs[focusIndex]?.focus(), 10);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otp.join('');
    if (fullOtp.length !== 6) {
      return setError('Please enter the complete 6-digit verification code.');
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const response = await API.post('/auth/verify-otp', { email, otpCode: fullOtp });

      if (response.data.success) {
        setSuccessMsg('Email verified successfully! Logging you in...');
        setTimeout(() => onSuccess(response.data), 1200);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Verification failed. Please check the code and try again.';
      setError(msg);
      // Clear inputs and refocus so user can retype immediately
      clearAndRefocus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await API.post('/auth/resend-otp', { email });
      setSuccessMsg('A new 6-digit code has been sent to your email.');
      setTimeLeft(600); // Reset 10 min timer
      setOtp(['', '', '', '', '', '']);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-100 w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 tracking-tight">Enter Verification Code</h3>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            We sent a 6-digit verification OTP to:
          </p>
          <p className="text-sm font-semibold text-blue-600 mt-0.5">{email}</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-xs px-3.5 py-2.5 rounded-md font-medium">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-3.5 py-2.5 rounded-md font-medium flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleVerify}>
          <div className="flex justify-between items-center gap-2 mb-6">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={index === 0 ? firstInputRef : undefined}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(e.target, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onPaste={handlePaste}
                onFocus={(e) => e.target.select()}
                className="otp-input-field w-12 h-12 text-center text-xl font-bold text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:border-blue-600 focus:bg-white focus:outline-none transition-all"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || otp.join('').length !== 6}
            className="w-full py-3 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
          >
            {loading ? 'Verifying OTP...' : 'Verify & Log In'}
          </button>
        </form>

        <div className="mt-5 text-center flex items-center justify-between text-xs text-gray-500 border-t border-gray-100 pt-4">
          <span>
            Code expires in: <strong className="text-gray-700">{formatTime(timeLeft)}</strong>
          </span>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || timeLeft > 540} // Allow resend after 1 min
            className="text-blue-600 hover:text-blue-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center space-x-1 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
            <span>{resending ? 'Sending...' : 'Resend Code'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default OTPVerificationModal;
