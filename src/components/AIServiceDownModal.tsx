import React, { useState, useEffect } from 'react';
import { AlertCircle, X, RotateCcw } from 'lucide-react';

interface AIServiceDownEventDetail {
  message?: string;
  endpoint?: string;
}

export const triggerAIServiceDownPopup = (message?: string) => {
  window.dispatchEvent(
    new CustomEvent<AIServiceDownEventDetail>('ai-service-down', {
      detail: {
        message: message || 'The AI service is temporarily unavailable. Please try again in a few moments.',
      },
    })
  );
};

const AIServiceDownModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState(
    'The AI service is temporarily unavailable. Please try again in a few moments.'
  );

  useEffect(() => {
    const handleAIServiceDown = (event: Event) => {
      const customEvent = event as CustomEvent<AIServiceDownEventDetail>;
      if (customEvent.detail?.message) {
        // Strip any residual emojis from incoming message for clean typography
        const cleanMsg = customEvent.detail.message
          .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
          .trim();
        setErrorMessage(cleanMsg);
      }
      setIsOpen(true);
    };

    window.addEventListener('ai-service-down', handleAIServiceDown);
    return () => {
      window.removeEventListener('ai-service-down', handleAIServiceDown);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4 animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-7 shadow-2xl text-left overflow-hidden ring-1 ring-black/5 dark:ring-white/10"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ai-service-down-title"
        aria-describedby="ai-service-down-desc"
      >
        {/* Close Button */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon + Title */}
        <div className="flex items-start space-x-3.5 mb-4">
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 id="ai-service-down-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              AI Service Temporarily Unavailable
            </h3>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">
              Service Connection Notice
            </p>
          </div>
        </div>

        {/* Body Message */}
        <div className="mb-6 space-y-3">
          <p id="ai-service-down-desc" className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
            The AI service is currently unavailable or undergoing temporary maintenance. Please wait a brief moment and try again.
          </p>

          {errorMessage && (
            <div className="rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3.5 text-left">
              <span className="text-slate-500 dark:text-slate-400 font-semibold text-[10px] uppercase tracking-wider block mb-1">
                System Status Detail
              </span>
              <p className="text-slate-900 dark:text-slate-200 text-xs font-mono leading-relaxed break-words">
                {errorMessage}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-2.5">
          <button
            onClick={() => {
              setIsOpen(false);
              window.location.reload();
            }}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            <span>Reload Page</span>
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 text-xs font-semibold shadow transition-all active:scale-[0.98]"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIServiceDownModal;
