import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useSwipeGestures } from '../hooks/useSwipeGestures';

// Touch gesture context
const TouchGestureContext = createContext({
  // Gesture states
  isDragging: false,
  isSwiping: false,
  swipeDirection: null,
  currentView: 'chat',

  // Gesture controls
  enableGestures: () => {},
  disableGestures: () => {},
  resetGestures: () => {},

  // Navigation callbacks
  onSwipeLeft: null,
  onSwipeRight: null,
  onSwipeUp: null,
  onSwipeDown: null,

  // Haptic feedback
  triggerHaptic: () => {},

  // Configuration
  gestureConfig: {}
});

export const useTouchGestures = () => {
  const context = useContext(TouchGestureContext);
  if (!context) {
    throw new Error('useTouchGestures must be used within a TouchGestureProvider');
  }
  return context;
};

export const TouchGestureProvider = ({ children }) => {
  const [gesturesEnabled, setGesturesEnabled] = useState(true);
  const [currentView, setCurrentView] = useState('chat');
  const [gestureConfig, setGestureConfig] = useState({
    threshold: 50,
    velocityThreshold: 0.3,
    restraint: 100,
    preventDefault: true
  });

  // Navigation state
  const [onSwipeLeft, setOnSwipeLeft] = useState(null);
  const [onSwipeRight, setOnSwipeRight] = useState(null);
  const [onSwipeUp, setOnSwipeUp] = useState(null);
  const [onSwipeDown, setOnSwipeDown] = useState(null);

  // Gesture state from useSwipeGestures hook
  const {
    isDragging,
    isSwiping,
    swipeDirection,
    reset
  } = useSwipeGestures(
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    {
      ...gestureConfig,
      disabled: !gesturesEnabled
    }
  );

  // Haptic feedback function
  const triggerHaptic = useCallback((pattern = 50) => {
    if ('vibrate' in navigator && gesturesEnabled) {
      try {
        navigator.vibrate(pattern);
      } catch (error) {
        // Silently ignore vibration errors
        console.debug('Vibration not supported:', error);
      }
    }
  }, [gesturesEnabled]);

  // Enable/disable gestures
  const enableGestures = useCallback(() => {
    setGesturesEnabled(true);
    triggerHaptic(20); // Light feedback for enabling
  }, [triggerHaptic]);

  const disableGestures = useCallback(() => {
    setGesturesEnabled(false);
    triggerHaptic(30); // Medium feedback for disabling
  }, [triggerHaptic]);

  // Reset gestures
  const resetGestures = useCallback(() => {
    reset();
    // swipeDirection is managed by useSwipeGestures hook
  }, [reset]);

  // Set navigation callbacks
  const setSwipeHandlers = useCallback((handlers) => {
    if (handlers.onSwipeLeft) setOnSwipeLeft(() => handlers.onSwipeLeft);
    if (handlers.onSwipeRight) setOnSwipeRight(() => handlers.onSwipeRight);
    if (handlers.onSwipeUp) setOnSwipeUp(() => handlers.onSwipeUp);
    if (handlers.onSwipeDown) setOnSwipeDown(() => handlers.onSwipeDown);
  }, []);

  // Handle window resize for gesture configuration
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;

      setGestureConfig(prev => ({
        ...prev,
        threshold: isMobile ? 40 : isTablet ? 60 : 80,
        velocityThreshold: isMobile ? 0.2 : 0.3,
        disabled: !isMobile && !isTablet
      }));
    };

    handleResize(); // Initial setup
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle orientation change
  useEffect(() => {
    const handleOrientationChange = () => {
      // Briefly disable gestures during orientation change
      disableGestures();

      setTimeout(() => {
        enableGestures();
        triggerHaptic([10, 30, 10]); // Triple vibration for orientation change
      }, 500);
    };

    window.addEventListener('orientationchange', handleOrientationChange);

    return () => window.removeEventListener('orientationchange', handleOrientationChange);
  }, [enableGestures, disableGestures, triggerHaptic]);

  // Handle visibility change (app goes to background)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App hidden, reset gestures
        resetGestures();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [resetGestures]);

  // Global gesture event listeners
  useEffect(() => {
    // Listen for custom gesture events
    const handleCustomSwipe = (event) => {
      const { direction, view } = event.detail;
      setCurrentView(view);
      triggerHaptic(40); // Medium vibration for view change
    };

    window.addEventListener('customSwipe', handleCustomSwipe);

    return () => window.removeEventListener('customSwipe', handleCustomSwipe);
  }, [triggerHaptic]);

  const value = {
    // Gesture states
    isDragging,
    isSwiping,
    swipeDirection,
    currentView,
    gesturesEnabled,

    // Gesture controls
    enableGestures,
    disableGestures,
    resetGestures,
    setSwipeHandlers,

    // Haptic feedback
    triggerHaptic,

    // Configuration
    gestureConfig,
    setGestureConfig
  };

  return (
    <TouchGestureContext.Provider value={value}>
      {children}
    </TouchGestureContext.Provider>
  );
};

export default TouchGestureProvider;