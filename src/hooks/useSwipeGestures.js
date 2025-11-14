import { useState, useCallback, useRef, useEffect } from 'react';
import { useSpring, animated } from '@react-spring/web';

// Hook configuration options
const defaultConfig = {
  threshold: 50, // Minimum swipe distance in pixels
  velocityThreshold: 0.3, // Minimum velocity for swipe detection
  restraint: 100, // Maximum restraint for swipe animation
  swipeTimeout: 300, // Timeout for swipe detection
  disabled: false,
  preventDefault: true,
  stopPropagation: false,
};

export const useSwipeGestures = (
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  config = {}
) => {
  const mergedConfig = { ...defaultConfig, ...config };
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Animation state
  const [animationProps, api] = useSpring(() => ({
    x: 0,
    y: 0,
    scale: 1,
    opacity: 1,
    config: { tension: 300, friction: 30 },
  }));

  const startPos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 0, y: 0 });
  const startTime = useRef(0);
  const elementRef = useRef(null);
  const rafId = useRef(null);

  // Calculate distance and velocity
  const calculateSwipeMetrics = useCallback((endX, endY) => {
    const deltaX = endX - startPos.current.x;
    const deltaY = endY - startPos.current.y;
    const deltaTime = Date.now() - startTime.current;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const velocityX = absX / deltaTime;
    const velocityY = absY / deltaTime;

    return { deltaX, deltaY, absX, absY, velocityX, velocityY, deltaTime };
  }, []);

  // Determine swipe direction
  const determineSwipeDirection = useCallback((deltaX, deltaY, absX, absY) => {
    if (absX > absY) {
      // Horizontal swipe
      return deltaX > 0 ? 'right' : 'left';
    } else {
      // Vertical swipe
      return deltaY > 0 ? 'down' : 'up';
    }
  }, []);

  // Execute swipe callback with haptic feedback
  const executeSwipeCallback = useCallback(
    direction => {
      // Trigger haptic feedback if supported
      if ('vibrate' in navigator) {
        navigator.vibrate(50); // Short vibration for swipe completion
      }

      // Execute appropriate callback
      switch (direction) {
        case 'left':
          if (onSwipeLeft) onSwipeLeft();
          break;
        case 'right':
          if (onSwipeRight) onSwipeRight();
          break;
        case 'up':
          if (onSwipeUp) onSwipeUp();
          break;
        case 'down':
          if (onSwipeDown) onSwipeDown();
          break;
      }
    },
    [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]
  );

  // Handle touch/mouse start
  const handleStart = useCallback(
    (clientX, clientY, event) => {
      if (mergedConfig.disabled) return;

      if (mergedConfig.preventDefault) {
        event.preventDefault();
      }

      if (mergedConfig.stopPropagation) {
        event.stopPropagation();
      }

      setIsDragging(true);
      setIsSwiping(false);
      setSwipeDirection(null);
      startTime.current = Date.now();

      startPos.current = { x: clientX, y: clientY };
      currentPos.current = { x: clientX, y: clientY };

      // Reset animation
      api.start({
        x: 0,
        y: 0,
        scale: 1,
        opacity: 1,
        immediate: true,
      });
    },
    [mergedConfig, api]
  );

  // Handle touch/mouse move
  const handleMove = useCallback(
    (clientX, clientY, event) => {
      if (!isDragging || mergedConfig.disabled) return;

      if (mergedConfig.preventDefault) {
        event.preventDefault();
      }

      currentPos.current = { x: clientX, y: clientY };
      const deltaX = clientX - startPos.current.x;
      const deltaY = clientY - startPos.current.y;

      // Apply restraint to prevent excessive movement
      const restrainedX = Math.max(
        -mergedConfig.restraint,
        Math.min(mergedConfig.restraint, deltaX)
      );
      const restrainedY = Math.max(
        -mergedConfig.restraint,
        Math.min(mergedConfig.restraint, deltaY)
      );

      // Update animation for visual feedback
      api.start({
        x: restrainedX,
        y: restrainedY,
        scale: 0.98,
        opacity: 0.9,
      });

      setIsSwiping(true);
    },
    [isDragging, mergedConfig, api]
  );

  // Handle touch/mouse end
  const handleEnd = useCallback(
    event => {
      if (!isDragging || mergedConfig.disabled) return;

      const { deltaX, deltaY, absX, absY, velocityX, velocityY } = calculateSwipeMetrics(
        currentPos.current.x,
        currentPos.current.y
      );

      const isSwipe = absX > mergedConfig.threshold || absY > mergedConfig.threshold;
      const isFastSwipe =
        velocityX > mergedConfig.velocityThreshold || velocityY > mergedConfig.velocityThreshold;

      if (isSwipe || isFastSwipe) {
        const direction = determineSwipeDirection(deltaX, deltaY, absX, absY);
        setSwipeDirection(direction);
        executeSwipeCallback(direction);

        // Animate completion
        api.start({
          x: direction === 'left' ? -100 : direction === 'right' ? 100 : 0,
          y: direction === 'up' ? -100 : direction === 'down' ? 100 : 0,
          scale: 0.95,
          opacity: 0.7,
        });
      } else {
        // Animate back to original position
        api.start({
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
        });
      }

      setIsDragging(false);
      setIsSwiping(false);
    },
    [
      isDragging,
      mergedConfig,
      calculateSwipeMetrics,
      determineSwipeDirection,
      executeSwipeCallback,
      api,
    ]
  );

  // Touch event handlers
  const handleTouchStart = useCallback(
    event => {
      const touch = event.touches[0];
      handleStart(touch.clientX, touch.clientY, event);
    },
    [handleStart]
  );

  const handleTouchMove = useCallback(
    event => {
      const touch = event.touches[0];
      handleMove(touch.clientX, touch.clientY, event);
    },
    [handleMove]
  );

  const handleTouchEnd = useCallback(
    event => {
      handleEnd(event);
    },
    [handleEnd]
  );

  // Mouse event handlers for desktop testing
  const handleMouseDown = useCallback(
    event => {
      const mouse = event;
      handleStart(mouse.clientX, mouse.clientY, event);

      // Add mouse move and up listeners to window for drag detection
      const handleMouseMove = moveEvent => {
        handleMove(moveEvent.clientX, moveEvent.clientY, moveEvent);
      };

      const handleMouseUp = upEvent => {
        handleEnd(upEvent);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [handleStart, handleMove, handleEnd]
  );

  // Cleanup
  useEffect(() => {
    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  // Spring animated div wrapper
  const AnimatedComponent = useCallback(
    ({ children, className = '', style = {}, ...props }) => (
      <animated.div
        ref={elementRef}
        className={`touch-gesture-container ${className}`}
        style={{
          transform: animationProps.x
            .to(x => `translateX(${x}px)`)
            .concat(animationProps.y.to(y => `, translateY(${y}px)`))
            .concat(animationProps.scale.to(s => ` scale(${s})`)),
          opacity: animationProps.opacity,
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'none',
          ...style,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        {...props}
      >
        {children}
      </animated.div>
    ),
    [animationProps, isDragging, handleTouchStart, handleTouchMove, handleTouchEnd, handleMouseDown]
  );

  return {
    // State
    isDragging,
    isSwiping,
    swipeDirection,

    // Animation props for custom styling
    animationProps,

    // Event handlers for manual attachment
    eventHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onMouseDown: handleMouseDown,
    },

    // Animated component wrapper
    AnimatedComponent,

    // Animation control
    api,

    // Reset function
    reset: useCallback(() => {
      api.start({ x: 0, y: 0, scale: 1, opacity: 1, immediate: true });
      setSwipeDirection(null);
      setIsSwiping(false);
      setIsDragging(false);
    }, [api]),
  };
};

export default useSwipeGestures;
