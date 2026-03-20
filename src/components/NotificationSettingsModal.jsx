import React from 'react';
import { Bell, XCircle } from 'lucide-react';

const NotificationSettingsModal = React.memo(function NotificationSettingsModal({
  onClose,
  pushSupported,
  pushPermission,
  pushSubscribed,
  pushLoading,
  notifyResults,
  notifyReminders,
  handlePushSubscribe,
  handlePushUnsubscribe,
  handleToggleNotifyPref,
}) {
  return (
    <div className="modal-overlay">
      <div className="modal-panel">
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="text-emerald-600 dark:text-emerald-400" size={20} />
              Notifications
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-150"
              aria-label="Close notification settings"
            >
              <XCircle size={28} />
            </button>
          </div>

          <div className="space-y-4">
            {!pushSupported ? (
              <p className="text-gray-600 dark:text-gray-400">
                Push notifications are not supported on this browser. Try using Chrome, Edge, or Safari 16.4+ with the app installed to your home screen.
              </p>
            ) : pushPermission === 'denied' ? (
              <p className="text-gray-600 dark:text-gray-400">
                Notifications are blocked. Please enable them in your browser or device settings, then refresh the page.
              </p>
            ) : pushSubscribed ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-gray-800 dark:text-gray-200 font-medium">Push notifications are enabled</p>
                  <button
                    onClick={handlePushUnsubscribe}
                    disabled={pushLoading}
                    className="btn-danger"
                  >
                    {pushLoading ? 'Updating...' : 'Disable All'}
                  </button>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-800 dark:text-gray-200 text-sm font-medium" id="notify-results-label">Results notifications</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">When weekly results are posted</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifyResults}
                      aria-labelledby="notify-results-label"
                      onClick={() => handleToggleNotifyPref('notify_results', !notifyResults)}
                      className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${notifyResults ? 'bg-green-500' : 'bg-gray-300 dark:bg-slate-500'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifyResults ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-800 dark:text-gray-200 text-sm font-medium" id="notify-reminders-label">Pick reminders</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Wednesday evening if you haven't picked yet</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifyReminders}
                      aria-labelledby="notify-reminders-label"
                      onClick={() => handleToggleNotifyPref('notify_reminders', !notifyReminders)}
                      className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${notifyReminders ? 'bg-green-500' : 'bg-gray-300 dark:bg-slate-500'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifyReminders ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-800 dark:text-gray-200 font-medium">Get notified when results are posted</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Receive push notifications on this device.</p>
                </div>
                <button
                  onClick={handlePushSubscribe}
                  disabled={pushLoading}
                  className="btn-primary px-4 py-2"
                >
                  {pushLoading ? 'Enabling...' : 'Enable'}
                </button>
              </div>
            )}
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

export default NotificationSettingsModal;
