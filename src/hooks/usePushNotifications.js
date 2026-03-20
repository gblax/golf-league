import { useState, useEffect } from 'react';

export function usePushNotifications(supabase, currentUser, showNotification) {
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [notifyResults, setNotifyResults] = useState(true);
  const [notifyReminders, setNotifyReminders] = useState(true);

  // Check push notification support
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setPushSupported(supported);
    if (supported) {
      setPushPermission(Notification.permission);
    }
  }, []);

  // Check existing push subscription when user logs in
  useEffect(() => {
    if (!currentUser || !pushSupported) return;
    const checkSub = async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const { data } = await supabase
            .from('push_subscriptions')
            .select('id, notify_results, notify_reminders')
            .eq('user_id', currentUser.id)
            .eq('endpoint', sub.endpoint)
            .maybeSingle();
          setPushSubscribed(!!data);
          if (data) {
            setNotifyResults(data.notify_results !== false);
            setNotifyReminders(data.notify_reminders !== false);
          }
        } else {
          setPushSubscribed(false);
        }
      } catch { setPushSubscribed(false); }
    };
    checkSub();
  }, [currentUser, pushSupported]);

  const handlePushSubscribe = async () => {
    if (!pushSupported || !currentUser) return;
    setPushLoading(true);
    try {
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        showNotification('error', 'Push notifications not configured');
        setPushLoading(false);
        return;
      }
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission !== 'granted') {
        showNotification('error', 'Notification permission denied');
        setPushLoading(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey
      });
      const subJson = sub.toJSON();
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: currentUser.id,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth
      }, { onConflict: 'user_id,endpoint' });
      if (error) throw error;
      setPushSubscribed(true);
      showNotification('success', 'Push notifications enabled!');
    } catch (err) {
      console.error('Push subscribe error:', err);
      showNotification('error', 'Failed to enable notifications');
    }
    setPushLoading(false);
  };

  const handlePushUnsubscribe = async () => {
    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('user_id', currentUser.id).eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setPushSubscribed(false);
      showNotification('success', 'Push notifications disabled');
    } catch (err) {
      console.error('Push unsubscribe error:', err);
      showNotification('error', 'Failed to disable notifications');
    }
    setPushLoading(false);
  };

  const handleToggleNotifyPref = async (pref, value) => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub || !currentUser) return;
      await supabase.from('push_subscriptions')
        .update({ [pref]: value })
        .eq('user_id', currentUser.id)
        .eq('endpoint', sub.endpoint);
      if (pref === 'notify_results') setNotifyResults(value);
      if (pref === 'notify_reminders') setNotifyReminders(value);
    } catch (err) {
      console.error('Toggle pref error:', err);
    }
  };

  return {
    pushSupported,
    pushPermission,
    pushSubscribed,
    pushLoading,
    notifyResults,
    notifyReminders,
    handlePushSubscribe,
    handlePushUnsubscribe,
    handleToggleNotifyPref,
  };
}
