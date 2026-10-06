import React from 'react';
import { Clock, ShieldAlert, LogOut, CheckCircle2 } from 'lucide-react';
import { useSessionTimeout } from '../../context/SessionTimeoutContext';

export default function SessionTimeoutModal() {
  const { showWarning, remainingSeconds, timeoutMinutes, resetInactivity, manualLogout } = useSessionTimeout();

  if (!showWarning) return null;

  const totalWarningSeconds = timeoutMinutes === 1 ? 20 : 35;
  const progressPercent = Math.max(0, Math.min(100, (remainingSeconds / totalWarningSeconds) * 100));

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-warning-title"
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-white p-6 sm:p-7 shadow-2xl ring-1 ring-black/10 animate-in zoom-in-95 duration-200"
      >
        {/* Top ambient highlight gradient */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400 via-rose-500 to-blue-600" />

        <div className="flex items-start gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 shadow-inner">
            <Clock size={28} className="animate-spin text-amber-600" style={{ animationDuration: '6s' }} />
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 ring-2 ring-white">
              <ShieldAlert size={10} className="text-white" />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 id="session-warning-title" className="text-lg font-bold text-slate-900">
                Session Inactivity Warning
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              No activity was detected for almost {timeoutMinutes} {timeoutMinutes === 1 ? 'minute' : 'minutes'}. To safeguard hotel inventory and financial records, you will be automatically signed out.
            </p>
          </div>
        </div>

        {/* Countdown Box */}
        <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50/70 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
            Auto-Logout Countdown
          </p>
          <div className="my-1.5 flex items-center justify-center gap-1.5">
            <span className="font-mono text-3xl font-extrabold text-amber-600 tracking-tight">
              {remainingSeconds}
            </span>
            <span className="text-sm font-semibold text-amber-700">seconds remaining</span>
          </div>

          {/* Progress bar */}
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-amber-200/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-1000 ease-linear"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col-reverse sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={manualLogout}
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-xs"
          >
            <LogOut size={14} />
            <span>Sign Out Now</span>
          </button>

          <button
            type="button"
            onClick={resetInactivity}
            autoFocus
            className="flex w-full flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/30 hover:bg-blue-700 hover:shadow-lg transition active:scale-[0.98]"
          >
            <CheckCircle2 size={16} />
            <span>Stay Signed In</span>
          </button>
        </div>
      </div>
    </div>
  );
}
