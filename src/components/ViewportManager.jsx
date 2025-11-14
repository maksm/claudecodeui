import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useVirtualKeyboard } from '../hooks/useVirtualKeyboard';
import { useResponsiveDesign } from '../hooks/useResponsiveDesign';

const ViewportManagerContext = createContext({
  // Keyboard state
  keyboardHeight: 0,
  isKeyboardVisible: false,
  safeAreaHeight: '100vh',
  safeAreaTop: '0px',

  // Viewport state
  viewportHeight: 0,
  viewportWidth: 0,
  adjustedViewportHeight: '100vh',

  // CSS utilities
  getViewportCSS: () => ({}),
  getSafeAreaCSS: () => ({}),

  // Actions
  scrollIntoView: () => {},
  registerInput: () => {},
  unregisterInput: () => {},

  // Responsive utilities
  isMobile: false,
  isTablet: false,
  isDesktop: false,
});

export const useViewport = () => {
  const context = useContext(ViewportManagerContext);
  if (!context) {
    throw new Error('useViewport must be used within a ViewportManagerProvider');
  }
  return context;
};

export const ViewportManagerProvider = ({ children }) => {
  const {
    keyboardHeight,
    isKeyboardVisible,
    viewportHeight,
    visualViewport,
    adjustedViewportHeight,
    scrollIntoView,
    safeAreaTop,
    safeAreaHeight,
    cssSafeAreaTop,
    cssSafeAreaHeight,
    cssKeyboardHeight,
    isLandscape,
    isPortrait,
  } = useVirtualKeyboard({
    onShow: height => {
      console.log(`Keyboard shown with height: ${height}px`);
    },
    onHide: () => {
      console.log('Keyboard hidden');
    },
  });

  const { deviceInfo, windowSize } = useResponsiveDesign();
  const [registeredInputs, setRegisteredInputs] = useState(new Set());
  const inputRefs = useRef(new Map());

  // Get current viewport width
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;

  // Get viewport CSS properties
  const getViewportCSS = useCallback(
    () => ({
      height: isKeyboardVisible ? `${adjustedViewportHeight}px` : '100vh',
      minHeight: isKeyboardVisible ? `${adjustedViewportHeight}px` : '100vh',
      maxHeight: isKeyboardVisible ? `${adjustedViewportHeight}px` : '100vh',
      width: '100vw',
      minWidth: '100vw',
      maxWidth: '100vw',
      overflow: 'hidden',
      position: 'relative',
    }),
    [isKeyboardVisible, adjustedViewportHeight]
  );

  // Get safe area CSS properties
  const getSafeAreaCSS = useCallback(
    () => ({
      paddingTop: cssSafeAreaTop,
      height: cssSafeAreaHeight,
      minHeight: cssSafeAreaHeight,
      maxHeight: cssSafeAreaHeight,
      boxSizing: 'border-box',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    }),
    [cssSafeAreaTop, cssSafeAreaHeight]
  );

  // Register input for keyboard tracking
  const registerInput = useCallback((id, element) => {
    setRegisteredInputs(prev => new Set(prev).add(id));
    inputRefs.current.set(id, element);
  }, []);

  // Unregister input
  const unregisterInput = useCallback(id => {
    setRegisteredInputs(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    inputRefs.current.delete(id);
  }, []);

  // Auto-scroll active input into view
  const handleInputFocus = useCallback(
    element => {
      if (!element || !isKeyboardVisible) return;

      // Add small delay to allow keyboard to fully appear
      setTimeout(() => {
        scrollIntoView(element, {
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }, 300);
    },
    [isKeyboardVisible, scrollIntoView]
  );

  // Enhanced scroll into view that handles all inputs
  const enhancedScrollIntoView = useCallback(
    (element, options = {}) => {
      scrollIntoView(element, options);

      // Register element for tracking
      const elementId = `input-${Date.now()}`;
      registerInput(elementId, element);

      // Auto cleanup after animation
      setTimeout(() => {
        unregisterInput(elementId);
      }, 1000);
    },
    [scrollIntoView, registerInput, unregisterInput]
  );

  // Handle global focus events
  useEffect(() => {
    const handleGlobalFocus = event => {
      const target = event.target;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        handleInputFocus(target);
      }
    };

    document.addEventListener('focusin', handleGlobalFocus, true);

    return () => {
      document.removeEventListener('focusin', handleGlobalFocus, true);
    };
  }, [handleInputFocus]);

  // Custom CSS variables for dynamic viewport handling
  useEffect(() => {
    const root = document.documentElement;

    // Set CSS custom properties
    root.style.setProperty('--viewport-height', `${viewportHeight}px`);
    root.style.setProperty('--adjusted-viewport-height', `${adjustedViewportHeight}px`);
    root.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
    root.style.setProperty('--safe-area-top', cssSafeAreaTop);
    root.style.setProperty('--safe-area-height', cssSafeAreaHeight);
    root.style.setProperty('--viewport-width', `${viewportWidth}px`);

    // Set responsive variables
    root.style.setProperty('--is-mobile', deviceInfo.isMobile ? '1' : '0');
    root.style.setProperty('--is-tablet', deviceInfo.isTablet ? '1' : '0');
    root.style.setProperty('--is-desktop', deviceInfo.isDesktop ? '1' : '0');
    root.style.setProperty('--is-landscape', isLandscape ? '1' : '0');
    root.style.setProperty('--is-portrait', isPortrait ? '1' : '0');

    return () => {
      // Cleanup custom properties
      root.style.removeProperty('--viewport-height');
      root.style.removeProperty('--adjusted-viewport-height');
      root.style.removeProperty('--keyboard-height');
      root.style.removeProperty('--safe-area-top');
      root.style.removeProperty('--safe-area-height');
      root.style.removeProperty('--viewport-width');
      root.style.removeProperty('--is-mobile');
      root.style.removeProperty('--is-tablet');
      root.style.removeProperty('--is-desktop');
      root.style.removeProperty('--is-landscape');
      root.style.removeProperty('--is-portrait');
    };
  }, [
    viewportHeight,
    adjustedViewportHeight,
    keyboardHeight,
    cssSafeAreaTop,
    cssSafeAreaHeight,
    viewportWidth,
    deviceInfo.isMobile,
    deviceInfo.isTablet,
    deviceInfo.isDesktop,
    isLandscape,
    isPortrait,
  ]);

  const value = {
    // Keyboard state
    keyboardHeight,
    isKeyboardVisible,
    safeAreaHeight,
    safeAreaTop,

    // Viewport state
    viewportHeight,
    viewportWidth,
    adjustedViewportHeight,

    // CSS utilities
    getViewportCSS,
    getSafeAreaCSS,

    // Actions
    scrollIntoView: enhancedScrollIntoView,
    registerInput,
    unregisterInput,

    // Responsive utilities
    isMobile: deviceInfo.isMobile,
    isTablet: deviceInfo.isTablet,
    isDesktop: deviceInfo.isDesktop,
    isLandscape,
    isPortrait,

    // Additional utilities
    visualViewport,
    registeredInputs: Array.from(registeredInputs),
  };

  return (
    <ViewportManagerContext.Provider value={value}>{children}</ViewportManagerContext.Provider>
  );
};

// Viewport-aware component wrapper
export const ViewportAware = ({
  children,
  className = '',
  style = {},
  adjustForKeyboard = true,
  safeArea = true,
  ...props
}) => {
  const { getViewportCSS, getSafeAreaCSS, isKeyboardVisible, isMobile } = useViewport();

  const combinedStyles = React.useMemo(() => {
    let styles = {};

    if (adjustForKeyboard && isMobile) {
      styles = { ...styles, ...getViewportCSS() };
    }

    if (safeArea) {
      styles = { ...styles, ...getSafeAreaCSS() };
    }

    return { ...styles, ...style };
  }, [adjustForKeyboard, safeArea, getViewportCSS, getSafeAreaCSS, style]);

  const combinedClassName = React.useMemo(() => {
    const classes = ['viewport-aware'];

    if (isKeyboardVisible) classes.push('keyboard-visible');
    if (isMobile) classes.push('mobile-viewport');
    if (adjustForKeyboard) classes.push('keyboard-adjusted');
    if (safeArea) classes.push('safe-area-aware');

    return [...classes, className].filter(Boolean).join(' ');
  }, [isKeyboardVisible, isMobile, adjustForKeyboard, safeArea, className]);

  return (
    <div className={combinedClassName} style={combinedStyles} {...props}>
      {children}
    </div>
  );
};

export default ViewportManagerProvider;
