import React from 'react';
import { Trophy } from 'lucide-react';
import NotificationToast from './NotificationToast';

const ResetPasswordScreen = React.memo(function ResetPasswordScreen({
  notification,
  newPassword,
  setNewPassword,
  handleResetPassword,
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 transition-colors duration-300">
      <NotificationToast notification={notification} />
      <div className="card p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-600 dark:bg-emerald-500 rounded-2xl mb-4">
            <Trophy className="text-white" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Set New Password</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Enter your new password below</p>
        </div>
        <div className="space-y-5">
          <div>
            <label className="label">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input"
              placeholder="New password (min 6 characters)"
            />
          </div>
          <button
            onClick={handleResetPassword}
            className="w-full btn-primary w-full py-3"
          >
            Update Password
          </button>
        </div>
      </div>
    </div>
  );
});

export default ResetPasswordScreen;
