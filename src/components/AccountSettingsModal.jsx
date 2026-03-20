import React from 'react';
import { Users, XCircle } from 'lucide-react';

const AccountSettingsModal = React.memo(function AccountSettingsModal({
  editName,
  setEditName,
  editEmail,
  setEditEmail,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  onClose,
  handleUpdateProfile,
  handleChangePassword,
}) {
  return (
    <div className="modal-overlay">
      <div className="modal-panel max-w-lg">
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="text-emerald-600 dark:text-emerald-400" size={20} />
              Account Settings
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-150"
            >
              <XCircle size={28} />
            </button>
          </div>

          {/* Profile Information Section */}
          <div className="mb-8 pb-6 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-semibold text-base mb-4 text-slate-900 dark:text-white">Profile Information</h3>

            <div className="space-y-4">
              <div>
                <label className="label">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="label">Email Address</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="input"
                  placeholder="your@email.com"
                />
              </div>

              <button
                onClick={handleUpdateProfile}
                className="btn-primary"
              >
                Save Profile Changes
              </button>
            </div>
          </div>

          {/* Change Password Section */}
          <div>
            <h3 className="font-semibold text-base mb-4 text-slate-900 dark:text-white">Change Password</h3>

            <div className="space-y-4">
              <div>
                <label className="label">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input"
                  placeholder="Enter new password (min 6 characters)"
                />
              </div>

              <div>
                <label className="label">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input"
                  placeholder="Confirm new password"
                />
              </div>

              <button
                onClick={handleChangePassword}
                className="btn-secondary text-slate-900 dark:text-white"
              >
                Update Password
              </button>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={onClose}
              className="btn-secondary w-full py-2.5"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default AccountSettingsModal;
