import React, { useState, useEffect } from 'react';
import { useTouchGestures } from '../contexts/TouchGestureContext';
import { animated, useSpring } from '@react-spring/web';

const MobileGestureIndicator = () => {
  const { isDragging, isSwiping, swipeDirection, gesturesEnabled } = useTouchGestures();
  const [showIndicator, setShowIndicator] = useState(false);

  // Animation for the indicator
  const indicatorAnimation = useSpring({
    opacity: showIndicator ? 1 : 0,
    transform: showIndicator ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(10px)',
    config: { tension: 300, friction: 25 },
  });

  // Direction arrow animation
  const arrowAnimation = useSpring({
    transform:
      swipeDirection === 'left'
        ? 'translateX(-5px)'
        : swipeDirection === 'right'
          ? 'translateX(5px)'
          : swipeDirection === 'up'
            ? 'translateY(-5px)'
            : swipeDirection === 'down'
              ? 'translateY(5px)'
              : 'translate(0, 0)',
    config: { tension: 200, friction: 20 },
  });

  // Show/hide indicator based on gesture state
  useEffect(() => {
    if (isSwiping) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowIndicator(true);
    } else if (!isDragging) {
      // Hide after a delay when dragging stops
      const timer = setTimeout(() => {
        setShowIndicator(false);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [isSwiping, isDragging]);

  // Don't show on desktop or if gestures are disabled
  if (typeof window === 'undefined' || window.innerWidth >= 1024 || !gesturesEnabled) {
    return null;
  }

  const getDirectionText = () => {
    switch (swipeDirection) {
      case 'left':
        return 'Next';
      case 'right':
        return 'Previous';
      case 'up':
        return 'Overview';
      case 'down':
        return 'Refresh';
      default:
        return 'Swipe';
    }
  };

  const getDirectionIcon = () => {
    switch (swipeDirection) {
      case 'left':
        return '→';
      case 'right':
        return '←';
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      default:
        return '↔';
    }
  };

  return (
    <animated.div
      style={{
        ...indicatorAnimation,
        position: 'fixed',
        bottom: isDragging ? '100px' : '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        pointerEvents: 'none',
      }}
    >
      <div className="mobile-gesture-indicator">
        <animated.div
          style={{
            ...arrowAnimation,
            display: 'inline-block',
            marginBottom: '4px',
          }}
        >
          {getDirectionIcon()}
        </animated.div>
        <div className="gesture-text">{getDirectionText()}</div>

        <style>{`
          .mobile-gesture-indicator {
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 20px;
            border-radius: 24px;
            font-size: 12px;
            font-weight: 600;
            text-align: center;
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            user-select: none;
            -webkit-user-select: none;
          }

          .gesture-text {
            white-space: nowrap;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          /* Dark mode support */
          @media (prefers-color-scheme: dark) {
            .mobile-gesture-indicator {
              background: rgba(255, 255, 255, 0.9);
              color: black;
            }
          }

          /* Accessibility: Respect reduced motion */
          @media (prefers-reduced-motion: reduce) {
            .mobile-gesture-indicator {
              transition: none;
            }
          }
        `}</style>
      </div>
    </animated.div>
  );
};

export default MobileGestureIndicator;
