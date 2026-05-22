import { useCallback, useRef } from 'react';

export const SOUND_KEY = 'soundNotifications';

const SOUND_URL = '/assets/notification_sound_1.mp3';

export function useNotificationSound() {
  const audioRef = useRef(null);

  return useCallback(() => {
    if (localStorage.getItem(SOUND_KEY) === 'false') return;
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(SOUND_URL);
        audioRef.current.volume = 0.7;
        audioRef.current.addEventListener('error', () => {
          if (import.meta.env.DEV) {
            console.warn(
              `[useNotificationSound] Failed to load audio file at "${SOUND_URL}". ` +
              'Make sure the file exists at public/assets/notification_sound_1.mp3'
            );
          }
        });
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => {
        if (import.meta.env.DEV) {
          console.warn('[useNotificationSound] play() rejected:', err.message);
        }
      });
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[useNotificationSound] unexpected error:', err);
      }
    }
  }, []);
}
