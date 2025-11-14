/* global CustomEvent */
import React, { useState, useEffect, useCallback } from 'react';
import { useSwipeGestures } from '../hooks/useSwipeGestures';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useTheme } from '../contexts/ThemeContext';

// Mobile navigation views
const VIEWS = {
  CHAT: 'chat',
  FILES: 'files',
  SHELL: 'shell',
  SETTINGS: 'settings',
};

const VIEW_ORDER = [VIEWS.CHAT, VIEWS.FILES, VIEWS.SHELL, VIEWS.SETTINGS];

const SwipeNavigation = ({ children, currentView, onViewChange }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isConnected } = useWebSocket();
  const { theme } = useTheme();

  const [isAnimating, setIsAnimating] = useState(false);
  const [previousView, setPreviousView] = useState(currentView);

  // Get current view index for navigation
  const getCurrentIndex = useCallback(view => {
    return VIEW_ORDER.indexOf(view);
  }, []);

  // Navigate to view by index
  const navigateToView = useCallback(
    targetIndex => {
      if (targetIndex < 0 || targetIndex >= VIEW_ORDER.length) return;

      const targetView = VIEW_ORDER[targetIndex];
      if (targetView === currentView || isAnimating) return;

      setIsAnimating(true);
      setPreviousView(currentView);

      // Trigger haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(30);
      }

      // Update view
      onViewChange?.(targetView);

      // Navigate to appropriate route
      const routes = {
        [VIEWS.CHAT]: '/chat',
        [VIEWS.FILES]: '/projects',
        [VIEWS.SHELL]: '/shell',
        [VIEWS.SETTINGS]: '/settings',
      };

      navigate(routes[targetView], { replace: true });

      // Reset animation state
      setTimeout(() => {
        setIsAnimating(false);
      }, 300);
    },
    [currentView, isAnimating, onViewChange, navigate]
  );

  // Swipe left handler (navigate to next view)
  const handleSwipeLeft = useCallback(() => {
    const currentIndex = getCurrentIndex(currentView);
    navigateToView(currentIndex + 1);
  }, [currentView, getCurrentIndex, navigateToView]);

  // Swipe right handler (navigate to previous view)
  const handleSwipeRight = useCallback(() => {
    const currentIndex = getCurrentIndex(currentView);
    navigateToView(currentIndex - 1);
  }, [currentView, getCurrentIndex, navigateToView]);

  // Swipe up handler (show overview/minimize current view)
  const handleSwipeUp = useCallback(() => {
    // Could implement a minimize/overview gesture
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }

    // Emit custom event for parent components
    window.dispatchEvent(new CustomEvent('swipeUpOverview'));
  }, []);

  // Swipe down handler (refresh current view)
  const handleSwipeDown = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate([10, 30, 10]); // Triple vibration pattern
    }

    // Emit custom event for pull-to-refresh
    window.dispatchEvent(
      new CustomEvent('swipeDownRefresh', {
        detail: { currentView },
      })
    );
  }, [currentView]);

  // Configure swipe gestures
  const swipeConfig = {
    threshold: window.innerWidth < 768 ? 40 : 60, // Lower threshold on mobile
    velocityThreshold: 0.2,
    restraint: 80,
    disabled: window.innerWidth >= 1024, // Disable on desktop
    preventDefault: true,
  };

  const { AnimatedComponent, isDragging, isSwiping, swipeDirection, reset } = useSwipeGestures(
    handleSwipeLeft,
    handleSwipeRight,
    handleSwipeUp,
    handleSwipeDown,
    swipeConfig
  );

  // Reset animation state when view changes externally
  useEffect(() => {
    if (currentView !== previousView) {
      reset();
    }
  }, [currentView, previousView, reset]);

  // Handle keyboard navigation for accessibility
  const handleKeyDown = useCallback(
    event => {
      if (window.innerWidth >= 1024) return; // Only on mobile

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          handleSwipeRight();
          break;
        case 'ArrowRight':
          event.preventDefault();
          handleSwipeLeft();
          break;
        case 'ArrowUp':
          event.preventDefault();
          handleSwipeUp();
          break;
        case 'ArrowDown':
          event.preventDefault();
          handleSwipeDown();
          break;
      }
    },
    [handleSwipeLeft, handleSwipeRight, handleSwipeUp, handleSwipeDown]
  );

  // Add keyboard event listeners
  useEffect(() => {
    if (window.innerWidth < 1024) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown]);

  // Render swipe navigation hint indicator
  const renderSwipeHint = () => {
    if (!isSwiping || window.innerWidth >= 1024) return null;

    const currentIndex = getCurrentIndex(currentView);
    const hasNext = currentIndex < VIEW_ORDER.length - 1;
    const hasPrevious = currentIndex > 0;

    return (
      <div className="swipe-hint">
        {hasPrevious && (
          <div className="swipe-hint-left">
            <span className="swipe-arrow">←</span>
            <span className="swipe-text">Previous</span>
          </div>
        )}
        {hasNext && (
          <div className="swipe-hint-right">
            <span className="swipe-text">Next</span>
            <span className="swipe-arrow">→</span>
          </div>
        )}
      </div>
    );
  };

  // Render connection status indicator
  const renderConnectionStatus = () => {
    if (isConnected) return null;

    return (
      <div className="connection-status">
        <span className="status-indicator">🔴</span>
        <span className="status-text">Offline</span>
      </div>
    );
  };

  return (
    <AnimatedComponent
      className={`swipe-navigation ${isDragging ? 'dragging' : ''} ${isSwiping ? 'swiping' : ''} ${isAnimating ? 'animating' : ''}`}
      style={{
        position: 'relative',
        minHeight: '100vh',
        touchAction: 'none',
      }}
    >
      {/* Visual feedback overlay */}
      {isDragging && (
        <div
          className="swipe-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `rgba(0, 0, 0, ${theme === 'dark' ? 0.1 : 0.05})`,
            pointerEvents: 'none',
            zIndex: 1000,
            backdropFilter: 'blur(1px)',
          }}
        />
      )}

      {/* Swipe hints */}
      {renderSwipeHint()}

      {/* Connection status */}
      {renderConnectionStatus()}

      {/* Main content */}
      <div className="swipe-content">{children}</div>

      {/* CSS for swipe navigation */}
      <style>{`
        .swipe-navigation {
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .swipe-navigation.dragging {
          cursor: grabbing;
        }

        .swipe-navigation.swiping {
          z-index: 1001;
        }

        .swipe-hint {
          position: fixed;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          justify-content: space-between;
          width: 100%;
          padding: 0 20px;
          pointer-events: none;
          z-index: 1002;
          opacity: 0.8;
        }

        .swipe-hint-left,
        .swipe-hint-right {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 500;
        }

        .swipe-arrow {
          font-size: 18px;
          font-weight: bold;
        }

        .connection-status {
          position: fixed;
          top: 20px;
          right: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(239, 68, 68, 0.9);
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          z-index: 1003;
        }

        .status-indicator {
          font-size: 10px;
        }

        @media (min-width: 1024px) {
          .swipe-hint,
          .connection-status {
            display: none;
          }
        }

        /* Dark theme support */
        .swipe-hint-left,
        .swipe-hint-right {
          background: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)'};
          color: ${theme === 'dark' ? 'black' : 'white'};
        }

        /* Accessibility: Reduce motion support */
        @media (prefers-reduced-motion: reduce) {
          .swipe-navigation {
            transition: none;
          }
        }
      `}</style>
    </AnimatedComponent>
  );
};

export default SwipeNavigation;
