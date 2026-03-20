import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

const NotificationToast = React.memo(function NotificationToast({ notification, onDismiss }) {
  if (!notification) return null;

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl shadow-elevated flex items-center gap-3 animate-slide-down max-w-sm w-[calc(100%-2rem)] sm:w-auto border ${
      notification.type === 'success'
        ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
        : 'bg-red-50 dark:bg-red-950/80 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
    }`}>
      {notification.type === 'success' ? (
        <CheckCircle size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
      ) : (
        <XCircle size={18} className="text-red-600 dark:text-red-400 shrink-0" />
      )}
      <span className="text-sm font-medium">{notification.message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-auto shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <XCircle size={16} />
        </button>
      )}
    </div>
  );
});

export default NotificationToast;
