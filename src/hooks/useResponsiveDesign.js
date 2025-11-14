/* global CSS, getComputedStyle */
import { useState, useEffect, useCallback } from 'react';

// Breakpoint definitions
const BREAKPOINTS = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1536,
};

// Default responsive config
const defaultConfig = {
  mobileFirst: true,
  touchOptimized: true,
  enableHapticFeedback: true,
  enableGestures: true,
  breakpoints: BREAKPOINTS,
};

export const useResponsiveDesign = (config = {}) => {
  const mergedConfig = { ...defaultConfig, ...config };

  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
    orientation:
      typeof window !== 'undefined'
        ? window.innerHeight > window.innerWidth
          ? 'portrait'
          : 'landscape'
        : 'landscape',
  });

  const [deviceInfo, setDeviceInfo] = useState({
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    isTouch: false,
    hasNotch: false,
    pixelRatio: 1,
    viewportHeight: '100vh',
  });

  const [breakpoint, setBreakpoint] = useState('lg');

  // Get current breakpoint based on width
  const getCurrentBreakpoint = useCallback(width => {
    if (width >= BREAKPOINTS.xl) return 'xl';
    if (width >= BREAKPOINTS.lg) return 'lg';
    if (width >= BREAKPOINTS.md) return 'md';
    if (width >= BREAKPOINTS.sm) return 'sm';
    return 'xs';
  }, []);

  // Check if device is mobile
  const isMobileDevice = useCallback(() => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }, []);

  // Check if device supports touch
  const isTouchDevice = useCallback(() => {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }, []);

  // Check for device notch (iPhone X+ and similar)
  const hasDeviceNotch = useCallback(() => {
    return (
      CSS.supports('padding-top', 'env(safe-area-inset-top)') &&
      window.innerWidth >= 375 &&
      window.innerHeight >= 812
    );
  }, []);

  // Get effective viewport height (accounting for mobile browser UI)
  const getEffectiveViewportHeight = useCallback(() => {
    if (typeof window === 'undefined') return '100vh';

    // On mobile, use dynamic viewport height
    if (window.innerWidth < 768) {
      // Check if browser supports dynamic viewport units
      if (CSS.supports('height', '100dvh')) {
        return '100dvh';
      }

      // Fallback: calculate based on actual available height
      const testDiv = document.createElement('div');
      testDiv.style.height = '100vh';
      testDiv.style.position = 'absolute';
      testDiv.style.top = '0';
      testDiv.style.left = '0';
      testDiv.style.visibility = 'hidden';
      testDiv.style.pointerEvents = 'none';

      document.body.appendChild(testDiv);
      const vh = testDiv.clientHeight;
      document.body.removeChild(testDiv);

      return `${vh}px`;
    }

    return '100vh';
  }, []);

  // Update window size and device info
  const updateDimensions = useCallback(() => {
    if (typeof window === 'undefined') return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const currentBreakpoint = getCurrentBreakpoint(width);
    const isMobile = width < BREAKPOINTS.md;
    const isTablet = width >= BREAKPOINTS.md && width < BREAKPOINTS.lg;
    const isDesktop = width >= BREAKPOINTS.lg;

    setWindowSize({
      width,
      height,
      orientation: height > width ? 'portrait' : 'landscape',
    });

    setDeviceInfo({
      isMobile,
      isTablet,
      isDesktop,
      isTouch: isTouchDevice(),
      hasNotch: hasDeviceNotch(),
      pixelRatio: window.devicePixelRatio || 1,
      viewportHeight: getEffectiveViewportHeight(),
    });

    setBreakpoint(currentBreakpoint);
  }, [getCurrentBreakpoint, isTouchDevice, hasDeviceNotch, getEffectiveViewportHeight]);

  // Handle window resize
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    updateDimensions();

    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateDimensions, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      clearTimeout(resizeTimer);
    };
  }, [updateDimensions]);

  // Responsive utilities
  const up = useCallback(
    targetBreakpoint => {
      const targetWidth = BREAKPOINTS[targetBreakpoint];
      return windowSize.width >= targetWidth;
    },
    [windowSize.width]
  );

  const down = useCallback(
    targetBreakpoint => {
      const targetWidth = BREAKPOINTS[targetBreakpoint];
      return windowSize.width < targetWidth;
    },
    [windowSize.width]
  );

  const between = useCallback(
    (minBreakpoint, maxBreakpoint) => {
      const minWidth = BREAKPOINTS[minBreakpoint];
      const maxWidth = BREAKPOINTS[maxBreakpoint];
      return windowSize.width >= minWidth && windowSize.width < maxWidth;
    },
    [windowSize.width]
  );

  const only = useCallback(
    targetBreakpoint => {
      return breakpoint === targetBreakpoint;
    },
    [breakpoint]
  );

  // Touch target utilities
  const getTouchTargetSize = useCallback(() => {
    if (deviceInfo.isMobile) return 48; // Mobile
    if (deviceInfo.isTablet) return 44; // Tablet
    return 32; // Desktop
  }, [deviceInfo.isMobile, deviceInfo.isTablet]);

  const getSpacing = useCallback(() => {
    if (deviceInfo.isMobile) return 12; // Mobile
    if (deviceInfo.isTablet) return 8; // Tablet
    return 4; // Desktop
  }, [deviceInfo.isMobile, deviceInfo.isTablet]);

  // Safe area utilities
  const getSafeAreaInsets = useCallback(() => {
    if (typeof window === 'undefined' || !deviceInfo.hasNotch) {
      return { top: 0, right: 0, bottom: 0, left: 0 };
    }

    const style = getComputedStyle(document.documentElement);
    return {
      top: parseInt(style.getPropertyValue('env(safe-area-inset-top)') || 0),
      right: parseInt(style.getPropertyValue('env(safe-area-inset-right)') || 0),
      bottom: parseInt(style.getPropertyValue('env(safe-area-inset-bottom)') || 0),
      left: parseInt(style.getPropertyValue('env(safe-area-inset-left)') || 0),
    };
  }, [deviceInfo.hasNotch]);

  // CSS class generator
  const getResponsiveClasses = useCallback(
    (baseClass, modifiers = {}) => {
      const classes = [baseClass];

      // Add breakpoint-specific classes
      Object.entries(modifiers).forEach(([breakpoint, condition]) => {
        if (condition) {
          classes.push(`${baseClass}:${breakpoint}`);
        }
      });

      // Add device-specific classes
      if (deviceInfo.isMobile) classes.push(`${baseClass}:mobile`);
      if (deviceInfo.isTablet) classes.push(`${baseClass}:tablet`);
      if (deviceInfo.isDesktop) classes.push(`${baseClass}:desktop`);
      if (deviceInfo.isTouch) classes.push(`${baseClass}:touch`);

      return classes.join(' ');
    },
    [deviceInfo]
  );

  // Haptic feedback utility
  const triggerHaptic = useCallback(
    (pattern = 50) => {
      if (!mergedConfig.enableHapticFeedback || !deviceInfo.isTouch) return;

      try {
        if ('vibrate' in navigator) {
          navigator.vibrate(pattern);
        }
      } catch (error) {
        // Silently ignore vibration errors
      }
    },
    [mergedConfig.enableHapticFeedback, deviceInfo.isTouch]
  );

  return {
    // Current state
    windowSize,
    deviceInfo,
    breakpoint,

    // Breakpoint utilities
    up,
    down,
    between,
    only,

    // Device utilities
    isMobileDevice: isMobileDevice(),
    isTouchDevice: deviceInfo.isTouch,

    // Responsive utilities
    getTouchTargetSize,
    getSpacing,
    getSafeAreaInsets,
    getResponsiveClasses,

    // Touch utilities
    triggerHaptic,

    // Configuration
    config: mergedConfig,
  };
};

export default useResponsiveDesign;
