import React, { useState, useRef, useEffect } from 'react';
import { useResponsiveDesign } from '../hooks/useResponsiveDesign';
import { useTouchGestures } from '../contexts/TouchGestureContext';

// Mobile-optimized button component
export const MobileButton = ({
  children,
  size = 'medium',
  variant = 'primary',
  fullWidth = false,
  haptic = true,
  className = '',
  onClick,
  disabled = false,
  ...props
}) => {
  const { getTouchTargetSize, triggerHaptic, deviceInfo } = useResponsiveDesign();
  const [isPressed, setIsPressed] = useState(false);

  const handleClick = event => {
    if (haptic && deviceInfo.isTouch) {
      triggerHaptic(25);
    }
    onClick?.(event);
  };

  const handlePressStart = () => {
    setIsPressed(true);
  };

  const handlePressEnd = () => {
    setIsPressed(false);
  };

  const baseClasses = 'mobile-btn touch-feedback focus-visible';
  const sizeClasses = {
    small: 'mobile-btn-sm',
    medium: 'mobile-btn-md',
    large: 'mobile-btn-lg',
  };

  const variantClasses = {
    primary: 'mobile-btn-primary',
    secondary: 'mobile-btn-secondary',
    ghost: 'mobile-btn-ghost',
    danger: 'mobile-btn-danger',
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${fullWidth ? 'mobile-btn-full' : ''} ${isPressed ? 'mobile-btn-pressed' : ''} ${className}`}
      style={{
        minHeight: `${getTouchTargetSize()}px`,
        width: fullWidth ? '100%' : 'auto',
      }}
      onClick={handleClick}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

// Mobile-optimized input component
export const MobileInput = ({
  type = 'text',
  placeholder,
  value,
  onChange,
  onFocus,
  onBlur,
  error = false,
  label,
  helperText,
  className = '',
  ...props
}) => {
  const { getTouchTargetSize, deviceInfo } = useResponsiveDesign();
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  const handleFocus = event => {
    setIsFocused(true);
    onFocus?.(event);

    // Adjust viewport on mobile
    if (deviceInfo.isMobile && inputRef.current) {
      setTimeout(() => {
        inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  };

  const handleBlur = event => {
    setIsFocused(false);
    onBlur?.(event);
  };

  return (
    <div className={`mobile-input-group ${className}`}>
      {label && <label className="mobile-input-label">{label}</label>}
      <input
        ref={inputRef}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={`mobile-input ${error ? 'mobile-input-error' : ''} ${isFocused ? 'mobile-input-focused' : ''}`}
        style={{
          minHeight: `${getTouchTargetSize()}px`,
          fontSize: '16px', // Prevents zoom on iOS
        }}
        {...props}
      />
      {helperText && (
        <div className={`mobile-input-helper ${error ? 'mobile-input-helper-error' : ''}`}>
          {helperText}
        </div>
      )}
    </div>
  );
};

// Mobile-optimized list component
export const MobileList = ({
  items = [],
  renderItem,
  onItemClick,
  pullToRefresh,
  onRefresh,
  className = '',
  ...props
}) => {
  const { isTouchDevice } = useResponsiveDesign();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const listRef = useRef(null);

  const handleTouchStart = e => {
    if (!pullToRefresh || listRef.current.scrollTop !== 0) return;
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = e => {
    if (!pullToRefresh || listRef.current.scrollTop !== 0) return;

    const currentY = e.touches[0].clientY;
    const distance = currentY - startY.current;

    if (distance > 0 && distance < 120) {
      setPullDistance(distance);
      e.preventDefault();
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 60 && onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    setPullDistance(0);
  };

  return (
    <div className={`mobile-list-container ${className}`}>
      {pullToRefresh && (
        <div
          className="mobile-pull-to-refresh"
          style={{
            height: `${pullDistance}px`,
            opacity: pullDistance / 100,
          }}
        >
          {isRefreshing ? <div className="mobile-spinner" /> : <span>↓ Pull to refresh</span>}
        </div>
      )}

      <div
        ref={listRef}
        className="mobile-list"
        onTouchStart={isTouchDevice ? handleTouchStart : undefined}
        onTouchMove={isTouchDevice ? handleTouchMove : undefined}
        onTouchEnd={isTouchDevice ? handleTouchEnd : undefined}
        {...props}
      >
        {items.map((item, index) => (
          <div key={index} className="mobile-list-item" onClick={() => onItemClick?.(item, index)}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
};

// Mobile-optimized modal component
export const MobileModal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'medium',
  swipeToClose = true,
  className = '',
  ...props
}) => {
  const { getTouchTargetSize, deviceInfo, triggerHaptic } = useResponsiveDesign();
  const { isDragging, swipeDirection } = useTouchGestures();
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsAnimating(true);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClose = () => {
    if (deviceInfo.isTouch) {
      triggerHaptic(30);
    }
    setIsAnimating(false);
    setTimeout(() => onClose(), 200);
  };

  if (!isOpen) return null;

  const sizeClasses = {
    small: 'mobile-modal-sm',
    medium: 'mobile-modal-md',
    large: 'mobile-modal-lg',
    full: 'mobile-modal-full',
  };

  return (
    <div className="mobile-modal-overlay">
      <div
        className={`mobile-modal ${sizeClasses[size]} ${isAnimating ? 'mobile-modal-open' : 'mobile-modal-closed'} ${className}`}
        {...props}
      >
        {title && (
          <div className="mobile-modal-header">
            <h2 className="mobile-modal-title">{title}</h2>
            <button
              onClick={handleClose}
              className="mobile-modal-close"
              style={{
                minHeight: `${getTouchTargetSize()}px`,
                width: `${getTouchTargetSize()}px`,
              }}
              aria-label="Close modal"
            >
              ×
            </button>
          </div>
        )}

        <div className="mobile-modal-content">{children}</div>
      </div>
    </div>
  );
};

// Mobile-optimized bottom sheet component
export const MobileBottomSheet = ({
  isOpen,
  onClose,
  title,
  children,
  snapPoints = [80, 50, 20],
  defaultSnap = 50,
  className = '',
  ...props
}) => {
  const { deviceInfo, triggerHaptic } = useResponsiveDesign();
  const [currentSnap, setCurrentSnap] = useState(defaultSnap);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const sheetRef = useRef(null);

  const snapToHeight = height => {
    if (sheetRef.current) {
      sheetRef.current.style.height = `${height}%`;
    }
    setCurrentSnap(height);
  };

  const handleDragStart = e => {
    setIsDragging(true);
    startY.current = e.touches[0].clientY;
    startHeight.current = currentSnap;
  };

  const handleDragMove = e => {
    if (!isDragging) return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startY.current;
    const windowHeight = window.innerHeight;
    const deltaPercentage = (deltaY / windowHeight) * 100;
    const newHeight = Math.max(10, Math.min(100, startHeight.current + deltaPercentage));

    snapToHeight(newHeight);
  };

  const handleDragEnd = () => {
    setIsDragging(false);

    // Find nearest snap point
    const nearestSnap = snapPoints.reduce((prev, curr) =>
      Math.abs(curr - currentSnap) < Math.abs(prev - currentSnap) ? curr : prev
    );

    // Close if pulled down significantly
    if (currentSnap < 15) {
      if (deviceInfo.isTouch) {
        triggerHaptic(50);
      }
      onClose();
    } else {
      if (deviceInfo.isTouch) {
        triggerHaptic(20);
      }
      snapToHeight(nearestSnap);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      snapToHeight(defaultSnap);
    }
  }, [isOpen, defaultSnap]);

  if (!isOpen) return null;

  return (
    <div className="mobile-bottom-sheet-overlay">
      <div
        ref={sheetRef}
        className={`mobile-bottom-sheet ${isDragging ? 'dragging' : ''} ${className}`}
        style={{ height: `${currentSnap}%` }}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
        {...props}
      >
        <div className="mobile-bottom-sheet-handle" />

        {title && (
          <div className="mobile-bottom-sheet-header">
            <h3 className="mobile-bottom-sheet-title">{title}</h3>
          </div>
        )}

        <div className="mobile-bottom-sheet-content">{children}</div>
      </div>
    </div>
  );
};

export default {
  MobileButton,
  MobileInput,
  MobileList,
  MobileModal,
  MobileBottomSheet,
};
