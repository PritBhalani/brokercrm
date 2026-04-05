import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext.tsx';
import { useNotifications } from '../context/NotificationContext.tsx';

export const useSocket = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  useEffect(() => {
    if (user) {
      // Request notification permission
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }

      const apiOrigin = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
      const isNgrok = Boolean(apiOrigin && /ngrok/i.test(apiOrigin));
      const socket = io(apiOrigin || undefined, {
        path: '/socket.io/',
        // Free ngrok returns HTML on polling XHR (no CORS). Prefer WebSocket first.
        ...(isNgrok && {
          transports: ['websocket', 'polling'],
          transportOptions: {
            polling: {
              extraHeaders: { 'ngrok-skip-browser-warning': 'true' },
            },
          },
        }),
      });
      socket.emit('join', user._id);

      socket.on('new_lead', (data) => {
        // Add to persistent notifications in Firestore
        addNotification({
          title: 'New Lead Assigned',
          message: `You have been assigned a new lead: ${data.name}`,
          type: 'info',
          link: `/leads/${data.leadId}`
        });

        // Show browser notification
        if (Notification.permission === 'granted') {
          new Notification('New Lead Assigned', {
            body: `You have been assigned a new lead: ${data.name}`,
            icon: '/favicon.ico' // Assuming there's a favicon
          });
        }
      });

      return () => {
        socket.off('new_lead');
        // In React StrictMode, effects mount/unmount twice in development.
        // Avoid disconnecting a socket that is still establishing to reduce noisy warnings.
        if (socket.connected) {
          socket.disconnect();
        }
      };
    }
  }, [user, addNotification]);
};
