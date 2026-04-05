import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext.tsx';
import { useNotifications } from '../context/NotificationContext.tsx';
import { getApiOrigin, isNgrokApiOrigin } from '../config/apiOrigin.ts';

export const useSocket = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  useEffect(() => {
    if (user) {
      // Request notification permission
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }

      const apiOrigin = getApiOrigin();
      const isNgrok = isNgrokApiOrigin(apiOrigin);
      const socket = io(apiOrigin || undefined, {
        path: '/socket.io/',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 20000,
        ...(isNgrok && {
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
