import { useEffect, useRef, useState } from 'react';

export function usePullToRefresh(onRefresh) {
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const lastY = useRef(0);
  const THRESHOLD = 70;

  useEffect(() => {
    const onTouchStart = (e) => {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e) => {
      if (startY.current !== null) {
        lastY.current = e.touches[0].clientY;
      }
    };

    const onTouchEnd = async () => {
      if (startY.current !== null) {
        const delta = lastY.current - startY.current;
        if (delta > THRESHOLD && !refreshing) {
          setRefreshing(true);
          try { await onRefresh(); } finally { setRefreshing(false); }
        }
      }
      startY.current = null;
      lastY.current = 0;
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [onRefresh, refreshing]);

  return { refreshing };
}