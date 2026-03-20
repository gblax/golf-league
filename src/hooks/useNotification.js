import { useState, useRef, useCallback } from 'react';

export function useNotification() {
  const [notification, setNotification] = useState(null);
  const timerRef = useRef(null);

  const showNotification = useCallback((type, message) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setNotification({ type, message });
    timerRef.current = setTimeout(() => {
      setNotification(null);
      timerRef.current = null;
    }, 4000);
  }, []);

  const clearNotification = useCallback(() => {
    setNotification(null);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { notification, showNotification, clearNotification };
}
