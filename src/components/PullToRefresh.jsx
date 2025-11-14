import React, { useState, useRef, useEffect, useCallback } from 'react';
import { animated, useSpring } from '@react-spring/web';
import { useResponsiveDesign } from '../hooks/useResponsiveDesign';
import { useTouchGestures } from '../contexts/TouchGestureContext';

const PullToRefresh = ({
  onRefresh,
  disabled = false,
  threshold = 80,
  maxPull = 200,
  children,
  className = '',
  ...props
}) => {
  const { isMobile, isTouchDevice } = useResponsiveDesign();
  const { triggerHaptic } = useTouchGestures();

  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [canRefresh, setCanRefresh] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startY = useRef(0);
  const containerRef = useRef(null);
  const contentRef = useRef(null);

  // Animation for pull indicator
  const pullAnimation = useSpring({
    height: pullDistance,
    opacity: pullDistance > 0 ? 1 : 0,
    config: { tension: 300, friction: 30 }
  });

  // Animation for refresh spinner
  const spinnerAnimation = useSpring({
    transform: isRefreshing ? 'rotate(360deg)' : 'rotate(0deg)',
    config: { duration: isRefreshing ? 1000 : 0 }
  });

  // Handle touch start
  const handleTouchStart = useCallback((e) => {
    if (disabled || !isMobile || !isTouchDevice) return;

    const touch = e.touches[0];
    startY.current = touch.clientY;

    // Only allow pull-to-refresh if at top of scrollable content
    if (contentRef.current) {
      const scrollTop = contentRef.current.scrollTop;
      if (scrollTop > 0) return;
    }

    setIsPulling(true);
    setCanRefresh(false);
  }, [disabled, isMobile, isTouchDevice]);

  // Handle touch move
  const handleTouchMove = useCallback((e) => {
    if (!isPulling || disabled) return;

    const touch = e.touches[0];
    const currentY = touch.clientY;
    const deltaY = currentY - startY.current;

    // Only pull down (positive delta)
    if (deltaY <= 0) return;

    // Calculate pull distance with resistance
    const resistance = 0.5;
    const calculatedPull = Math.min(deltaY * resistance, maxPull);

    setPullDistance(calculatedPull);
    setCanRefresh(calculatedPull >= threshold);

    // Haptic feedback at threshold
    if (calculatedPull >= threshold && !canRefresh) {
      triggerHaptic(50);
    }
  }, [isPulling, disabled, threshold, maxPull, canRefresh, triggerHaptic]);

  // Handle touch end
  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || disabled) return;

    if (canRefresh && !isRefreshing) {
      // Trigger refresh
      setIsRefreshing(true);
      triggerHaptic([50, 30, 50]); // Triple vibration

      try {
        if (onRefresh) {
          await onRefresh();
        }
      } catch (error) {
        console.error('Pull-to-refresh failed:', error);
      } finally {
        setIsRefreshing(false);
      }
    }

    // Reset pull state
    setPullDistance(0);
    setCanRefresh(false);
    setIsPulling(false);
  }, [isPulling, canRefresh, isRefreshing, disabled, onRefresh, triggerHaptic]);

  // Handle mouse events for desktop testing
  const handleMouseDown = useCallback((e) => {
    if (disabled || !isMobile) return;

    startY.current = e.clientY;
    setIsPulling(true);
    setCanRefresh(false);

    // Add mouse move and up listeners
    const handleMouseMove = (moveEvent) => {
      if (!isPulling) return;

      const deltaY = moveEvent.clientY - startY.current;
      if (deltaY <= 0) return;

      const resistance = 0.5;
      const calculatedPull = Math.min(deltaY * resistance, maxPull);

      setPullDistance(calculatedPull);
      setCanRefresh(calculatedPull >= threshold);

      if (calculatedPull >= threshold && !canRefresh) {
        triggerHaptic(50);
      }
    };

    const handleMouseUp = async () => {
      if (canRefresh && !isRefreshing) {
        setIsRefreshing(true);
        triggerHaptic([50, 30, 50]);

        try {
          if (onRefresh) {
            await onRefresh();
          }
        } catch (error) {
          console.error('Pull-to-refresh failed:', error);
        } finally {
          setIsRefreshing(false);
        }
      }

      setPullDistance(0);
      setCanRefresh(false);
      setIsPulling(false);

      // Remove event listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [disabled, isMobile, maxPull, threshold, canRefresh, isRefreshing, onRefresh, triggerHaptic]);

  // Reset state when refreshing completes
  useEffect(() => {
    if (!isRefreshing) {
      setPullDistance(0);
      setCanRefresh(false);
    }
  }, [isRefreshing]);

  // Disable on desktop or when explicitly disabled
  if (!isMobile || disabled) {
    return <>{children}</>;
  }

  const getPullText = () => {
    if (isRefreshing) return 'Refreshing...';
    if (canRefresh) return 'Release to refresh';
    if (pullDistance > 20) return 'Pull to refresh';
    return '';
  };

  const getPullIcon = () => {
    if (isRefreshing) {
      return (
        <animated.div style={spinnerAnimation}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
        </animated.div>
      );
    }

    if (canRefresh) {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12a9 9 0 016.219-8.56" />
          <path d="M3 3v5h5" />
          <path d="M21 12a9 9 0 01-6.219 8.56" />
          <path d="M21 21v-5h-5" />
        </svg>
      );
    }

    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`pull-to-refresh-container ${isPulling ? 'pulling' : ''} ${className}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        touchAction: 'pan-y' // Allow vertical scrolling
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      {...props}
    >
      {/* Pull-to-refresh indicator */}
      <animated.div
        style={{
          ...pullAnimation,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '8px',
          background: canRefresh ? '#3b82f6' : '#6b7280',
          color: 'white',
          fontSize: '14px',
          fontWeight: '500',
          zIndex: 1000,
          borderRadius: '0 0 16px 16px',
          padding: '16px'
        }}
      >
        <div style={{ color: 'white' }}>
          {getPullIcon()}
        </div>
        <span style={{ color: 'white' }}>
          {getPullText()}
        </span>
      </animated.div>

      {/* Content wrapper */}
      <div
        ref={contentRef}
        className="pull-to-refresh-content"
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : 'translateY(0)',
          transition: isPulling ? 'none' : 'transform 0.3s ease',
          minHeight: '100%',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {children}
      </div>

      {/* CSS for the component */}
      <style>{`
        .pull-to-refresh-container {
          user-select: none;
          -webkit-user-select: none;
        }

        .pull-to-refresh-container.pulling {
          cursor: grabbing;
        }

        .pull-to-refresh-content {
          position: relative;
        }

        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          .pull-to-refresh-container :global(animated) {
            background: ${canRefresh ? '#2563eb' : '#4b5563'};
          }
        }

        /* Accessibility: Respect reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .pull-to-refresh-content {
            transition: none;
          }

          :global(.animated) {
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default PullToRefresh;