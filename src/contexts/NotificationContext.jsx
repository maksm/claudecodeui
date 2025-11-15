import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [settings, setSettings] = useState(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('notificationSettings');
    if (savedSettings) {
      try {
        return JSON.parse(savedSettings);
      } catch (e) {
        console.error('Failed to parse notification settings:', e);
      }
    }
    // Default settings
    return {
      agentCompletion: true,
      ciCompletion: true,
      browserNotifications: false,
    };
  });

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('notificationSettings', JSON.stringify(settings));
  }, [settings]);

  // Request browser notification permission
  const requestBrowserPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn('Browser notifications are not supported');
      return false;
    }

    // eslint-disable-next-line no-undef
    if (Notification.permission === 'granted') {
      return true;
    }

    // eslint-disable-next-line no-undef
    if (Notification.permission !== 'denied') {
      // eslint-disable-next-line no-undef
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }, []);

  // Update settings
  const updateSettings = useCallback(newSettings => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // Remove a notification
  const removeNotification = useCallback(id => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Add a toast notification
  const addNotification = useCallback(
    notification => {
      const id = Date.now() + Math.random();
      const newNotification = {
        id,
        timestamp: new Date(),
        ...notification,
      };

      setNotifications(prev => [...prev, newNotification]);

      // Auto-remove after duration (default 5 seconds)
      const duration = notification.duration || 5000;
      if (duration > 0) {
        setTimeout(() => {
          removeNotification(id);
        }, duration);
      }

      return id;
    },
    [removeNotification]
  );

  // Show browser notification
  const showBrowserNotification = useCallback(
    (title, options = {}) => {
      if (!settings.browserNotifications) {
        return;
      }

      // eslint-disable-next-line no-undef
      if ('Notification' in window && Notification.permission === 'granted') {
        // eslint-disable-next-line no-undef
        const notification = new Notification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          ...options,
        });

        // Auto-close after 5 seconds
        setTimeout(() => {
          notification.close();
        }, 5000);

        return notification;
      }
    },
    [settings.browserNotifications]
  );

  // Notify agent completion
  const notifyAgentCompletion = useCallback(
    (projectName, success = true) => {
      if (!settings.agentCompletion) {
        return;
      }

      const message = success
        ? `Agent completed successfully in ${projectName}`
        : `Agent failed in ${projectName}`;

      const type = success ? 'success' : 'error';

      // Show toast notification
      addNotification({
        type,
        title: 'Agent Completed',
        message,
      });

      // Show browser notification
      showBrowserNotification('Agent Completed', {
        body: message,
        tag: 'agent-completion',
      });
    },
    [settings.agentCompletion, addNotification, showBrowserNotification]
  );

  // Notify CI completion
  const notifyCICompletion = useCallback(
    (workflowName, success = true) => {
      if (!settings.ciCompletion) {
        return;
      }

      const message = success
        ? `CI workflow "${workflowName}" completed successfully`
        : `CI workflow "${workflowName}" failed`;

      const type = success ? 'success' : 'error';

      // Show toast notification
      addNotification({
        type,
        title: 'CI Completed',
        message,
      });

      // Show browser notification
      showBrowserNotification('CI Completed', {
        body: message,
        tag: 'ci-completion',
      });
    },
    [settings.ciCompletion, addNotification, showBrowserNotification]
  );

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const value = {
    notifications,
    settings,
    updateSettings,
    addNotification,
    removeNotification,
    notifyAgentCompletion,
    notifyCICompletion,
    clearAll,
    requestBrowserPermission,
    showBrowserNotification,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};
