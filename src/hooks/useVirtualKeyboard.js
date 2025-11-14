import { useState, useEffect, useCallback, useRef } from 'react';

export const useVirtualKeyboard = (options = {}) => {
  const {
    onShow = null,
    onHide = null,
    onChange = null,
    offset = 0,
    delay = 100
  } = options;

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 0
  );
  const [visualViewport, setVisualViewport] = useState({
    height: 0,
    width: 0,
    offsetTop: 0,
    offsetLeft: 0
  });

  const initialViewportHeight = useRef(0);
  const keyboardTimeoutRef = useRef(null);
  const resizeObserverRef = useRef(null);

  // Detect if browser supports Visual Viewport API
  const supportsVisualViewportAPI = useCallback(() => {
    return typeof window !== 'undefined' && 'visualViewport' in window;
  }, []);

  // Get initial viewport height
  const getInitialViewportHeight = useCallback(() => {
    if (typeof window === 'undefined') return 0;

    // On mobile, use the smaller of innerHeight and screen height
    const screenHeight = screen.height;
    const innerHeight = window.innerHeight;
    const calculatedHeight = Math.min(innerHeight, screenHeight);

    return calculatedHeight;
  }, []);

  // Calculate keyboard height
  const calculateKeyboardHeight = useCallback(() => {
    if (typeof window === 'undefined') return 0;

    if (supportsVisualViewportAPI()) {
      const vv = window.visualViewport;
      const keyboardHeight = Math.floor(vv.height - vv.offsetTop);
      return Math.max(0, keyboardHeight);
    }

    // Fallback: compare current viewport height with initial height
    const currentHeight = window.innerHeight;
    const heightDifference = initialViewportHeight.current - currentHeight;
    return Math.max(0, heightDifference);
  }, [supportsVisualViewportAPI]);

  // Update visual viewport information
  const updateVisualViewport = useCallback(() => {
    if (supportsVisualViewportAPI()) {
      const vv = window.visualViewport;
      setVisualViewport({
        height: vv.height,
        width: vv.width,
        offsetTop: vv.offsetTop,
        offsetLeft: vv.offsetLeft
      });
    }
  }, [supportsVisualViewportAPI]);

  // Handle keyboard show
  const handleKeyboardShow = useCallback(() => {
    const height = calculateKeyboardHeight();
    const isVisible = height > 150; // Minimum height to consider keyboard visible

    setIsKeyboardVisible(isVisible);
    setKeyboardHeight(height);

    if (isVisible && onShow) {
      onShow(height);
    }

    onChange?.({ visible: isVisible, height });
  }, [calculateKeyboardHeight, onShow, onChange]);

  // Handle keyboard hide
  const handleKeyboardHide = useCallback(() => {
    setIsKeyboardVisible(false);
    setKeyboardHeight(0);

    if (onHide) {
      onHide();
    }

    onChange?.({ visible: false, height: 0 });
  }, [onHide, onChange]);

  // Handle viewport resize
  const handleViewportResize = useCallback(() => {
    const currentHeight = window.innerHeight;
    setViewportHeight(currentHeight);

    if (initialViewportHeight.current === 0) {
      initialViewportHeight.current = getInitialViewportHeight();
    }

    updateVisualViewport();

    // Clear any existing timeout
    if (keyboardTimeoutRef.current) {
      clearTimeout(keyboardTimeoutRef.current);
    }

    // Debounce keyboard detection
    keyboardTimeoutRef.current = setTimeout(() => {
      const heightDifference = initialViewportHeight.current - currentHeight;

      if (heightDifference > 150) {
        // Keyboard likely showing
        handleKeyboardShow();
      } else {
        // Keyboard likely hidden
        handleKeyboardHide();
      }
    }, delay);
  }, [getInitialViewportHeight, updateVisualViewport, handleKeyboardShow, handleKeyboardHide, delay]);

  // Handle Visual Viewport API changes
  const handleVisualViewportResize = useCallback(() => {
    updateVisualViewport();
    handleViewportResize();
  }, [updateVisualViewport, handleViewportResize]);

  // Focus handling for inputs
  const handleFocusIn = useCallback((event) => {
    const target = event.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      // Small delay to allow keyboard to appear
      setTimeout(() => {
        handleKeyboardShow();
      }, 300);
    }
  }, [handleKeyboardShow]);

  const handleFocusOut = useCallback((event) => {
    const target = event.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      // Small delay to allow keyboard to disappear
      setTimeout(() => {
        handleKeyboardHide();
      }, 100);
    }
  }, [handleKeyboardHide]);

  // Scroll active element into view
  const scrollIntoView = useCallback((element, options = {}) => {
    if (!element || typeof window === 'undefined') return;

    const defaultOptions = {
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest'
    };

    const mergedOptions = { ...defaultOptions, ...options };

    // Add keyboard height offset if keyboard is visible
    if (isKeyboardVisible && keyboardHeight > 0) {
      const rect = element.getBoundingClientRect();
      const offset = keyboardHeight - offset;

      if (rect.bottom + offset > window.innerHeight) {
        window.scrollBy({
          top: offset,
          left: 0,
          behavior: mergedOptions.behavior
        });
      }
    } else {
      element.scrollIntoView(mergedOptions);
    }
  }, [isKeyboardVisible, keyboardHeight, offset]);

  // Get adjusted viewport height
  const getAdjustedViewportHeight = useCallback(() => {
    if (isKeyboardVisible) {
      return viewportHeight - keyboardHeight;
    }
    return viewportHeight;
  }, [isKeyboardVisible, viewportHeight, keyboardHeight]);

  // Get CSS viewport value
  const getCSSViewportHeight = useCallback(() => {
    if (typeof window === 'undefined') return '100vh';

    // Use dynamic viewport height if supported
    if (CSS.supports('height', '100dvh')) {
      return isKeyboardVisible ? '100dvh' : '100dvh';
    }

    // Fallback to calculated height
    return `${getAdjustedViewportHeight()}px`;
  }, [isKeyboardVisible, getAdjustedViewportHeight]);

  // Setup event listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Initialize viewport height
    initialViewportHeight.current = getInitialViewportHeight();
    setViewportHeight(window.innerHeight);
    updateVisualViewport();

    // Window resize listener
    window.addEventListener('resize', handleViewportResize);

    // Visual Viewport API listeners
    if (supportsVisualViewportAPI()) {
      const vv = window.visualViewport;
      vv.addEventListener('resize', handleVisualViewportResize);
      vv.addEventListener('scroll', handleVisualViewportResize);
    }

    // Focus/blur listeners for keyboard detection
    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('focusout', handleFocusOut, true);

    // ResizeObserver for more accurate viewport tracking
    if ('ResizeObserver' in window) {
      resizeObserverRef.current = new ResizeObserver(() => {
        handleViewportResize();
      });

      resizeObserverRef.current.observe(document.body);
    }

    // Initial keyboard check
    handleViewportResize();

    return () => {
      // Cleanup event listeners
      window.removeEventListener('resize', handleViewportResize);

      if (supportsVisualViewportAPI()) {
        const vv = window.visualViewport;
        vv.removeEventListener('resize', handleVisualViewportResize);
        vv.removeEventListener('scroll', handleVisualViewportResize);
      }

      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('focusout', handleFocusOut, true);

      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }

      if (keyboardTimeoutRef.current) {
        clearTimeout(keyboardTimeoutRef.current);
      }
    };
  }, [
    getInitialViewportHeight,
    updateVisualViewport,
    handleViewportResize,
    handleVisualViewportResize,
    handleFocusIn,
    handleFocusOut,
    supportsVisualViewportAPI
  ]);

  // Orientation change handler
  useEffect(() => {
    const handleOrientationChange = () => {
      // Reset viewport height after orientation change
      setTimeout(() => {
        initialViewportHeight.current = getInitialViewportHeight();
        handleViewportResize();
      }, 500);
    };

    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [getInitialViewportHeight, handleViewportResize]);

  return {
    // State
    isKeyboardVisible,
    keyboardHeight,
    viewportHeight,
    visualViewport,
    adjustedViewportHeight: getAdjustedViewportHeight(),

    // Utilities
    scrollIntoView,
    getCSSViewportHeight,

    // Computed values
    safeAreaTop: visualViewport.offsetTop,
    safeAreaHeight: isKeyboardVisible ? visualViewport.height : viewportHeight,

    // Viewport utilities
    isLandscape: window.innerWidth > window.innerHeight,
    isPortrait: window.innerWidth <= window.innerHeight,

    // CSS-safe values
    cssSafeAreaTop: `${visualViewport.offsetTop}px`,
    cssSafeAreaHeight: isKeyboardVisible ? `${visualViewport.height}px` : '100vh',
    cssKeyboardHeight: `${keyboardHeight}px`
  };
};

export default useVirtualKeyboard;