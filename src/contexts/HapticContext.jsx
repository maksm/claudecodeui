import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';

// Haptic patterns for different interactions
const HAPTIC_PATTERNS = {
  // Success patterns
  SUCCESS: [50],
  SUCCESS_DOUBLE: [50, 30, 50],
  SUCCESS_TRIPLE: [50, 30, 50, 30, 50],

  // Error patterns
  ERROR: [100, 50, 100],
  ERROR_DOUBLE: [150, 100, 150],
  ERROR_PULSE: [200, 50, 200, 50, 200],

  // Feedback patterns
  TAP: [25],
  PRESS: [50],
  LONG_PRESS: [100],
  DOUBLE_TAP: [25, 50, 25],

  // Navigation patterns
  SWIPE: [30],
  SWIPE_LEFT: [20, 10, 30],
  SWIPE_RIGHT: [30, 10, 20],
  NAVIGATION: [40],

  // Notification patterns
  NOTIFICATION: [50, 30, 50],
  NOTIFICATION_IMPORTANT: [100, 50, 100, 50, 100],
  NOTIFICATION_GENTLE: [20, 10, 20],

  // System patterns
  SYSTEM: [25],
  SYSTEM_ERROR: [200, 100, 200],
  SYSTEM_SUCCESS: [60, 40, 60],
  SYSTEM_WARNING: [80, 40, 80],

  // Interaction patterns
  SELECT: [30],
  DESELECT: [20],
  DRAG_START: [40],
  DRAG_END: [30],
  DROP_SUCCESS: [60, 30, 60],
  DROP_FAIL: [100, 50, 100],

  // Volume/intensity levels
  GENTLE: [10],
  LIGHT: [25],
  MEDIUM: [50],
  STRONG: [100],
  HEAVY: [200]
};

// Device capability detection
const getDeviceCapabilities = () => {
  if (typeof navigator === 'undefined') {
    return {
      supported: false,
      canVibrate: false,
      maxDuration: 0,
      maxIntensity: 0,
      deviceType: 'unknown'
    };
  }

  const capabilities = {
    supported: 'vibrate' in navigator,
    canVibrate: 'vibrate' in navigator,
    maxDuration: 0,
    maxIntensity: 0,
    deviceType: 'unknown'
  };

  if (capabilities.canVibrate) {
    try {
      // Test vibration support
      navigator.vibrate(0);

      // Detect device type for capability estimation
      const userAgent = navigator.userAgent.toLowerCase();

      if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
        capabilities.deviceType = 'ios';
        capabilities.maxDuration = 5000; // iOS typically supports longer vibrations
        capabilities.maxIntensity = 1; // iOS has limited intensity control
      } else if (userAgent.includes('android')) {
        capabilities.deviceType = 'android';
        capabilities.maxDuration = 10000; // Android typically supports longer vibrations
        capabilities.maxIntensity = 1; // Android intensity varies by device
      } else {
        capabilities.deviceType = 'other';
        capabilities.maxDuration = 5000;
        capabilities.maxIntensity = 1;
      }
    } catch (error) {
      capabilities.canVibrate = false;
      console.debug('Vibration not supported:', error);
    }
  }

  return capabilities;
};

const HapticContext = createContext({
  // State
  enabled: true,
  intensity: 1,
  capabilities: {},
  patternHistory: [],

  // Actions
  trigger: () => {},
  triggerPattern: () => {},
  setEnabled: () => {},
  setIntensity: () => {},
  getDeviceCapabilities: () => {}
});

export const useHaptic = () => {
  const context = useContext(HapticContext);
  if (!context) {
    throw new Error('useHaptic must be used within a HapticProvider');
  }
  return context;
};

export const HapticProvider = ({ children, defaultEnabled = true, defaultIntensity = 1 }) => {
  const [enabled, setEnabled] = useState(defaultEnabled);
  const [intensity, setIntensity] = useState(defaultIntensity);
  const [capabilities, setCapabilities] = useState({});
  const [patternHistory, setPatternHistory] = useState([]);

  // Get device capabilities on mount
  useEffect(() => {
    const deviceCaps = getDeviceCapabilities();
    setCapabilities(deviceCaps);

    console.log('Haptic capabilities:', deviceCaps);
  }, []);

  // Apply intensity to vibration pattern
  const applyIntensity = useCallback((pattern, intensityLevel) => {
    if (!Array.isArray(pattern)) {
      return pattern;
    }

    return pattern.map(duration => {
      const adjustedDuration = Math.round(duration * intensityLevel);
      return Math.max(0, Math.min(adjustedDuration, capabilities.maxDuration || 10000));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capabilities.maxDuration]);

  // Trigger haptic feedback
  const trigger = useCallback((pattern = HAPTIC_PATTERNS.TAP, customIntensity = null) => {
    if (!enabled || !capabilities.canVibrate) {
      return false;
    }

    try {
      const finalIntensity = customIntensity !== null ? customIntensity : intensity;
      const adjustedPattern = applyIntensity(pattern, finalIntensity);

      // Add to history
      setPatternHistory(prev => [...prev.slice(-9), {
        pattern: adjustedPattern,
        timestamp: Date.now(),
        intensity: finalIntensity
      }]);

      // Trigger vibration
      navigator.vibrate(adjustedPattern);

      console.debug('Haptic triggered:', { pattern: adjustedPattern, intensity: finalIntensity });
      return true;
    } catch (error) {
      console.error('Haptic trigger failed:', error);
      return false;
    }
  }, [enabled, capabilities.canVibrate, intensity, applyIntensity]);

  // Trigger specific pattern by name
  const triggerPattern = useCallback((patternName, customIntensity = null) => {
    const pattern = HAPTIC_PATTERNS[patternName.toUpperCase()];
    if (!pattern) {
      console.warn(`Unknown haptic pattern: ${patternName}`);
      return false;
    }

    return trigger(pattern, customIntensity);
  }, [trigger]);

  // Get device capabilities
  const getDeviceCapabilities = useCallback(() => {
    return capabilities;
  }, [capabilities]);

  // Clear pattern history
  const clearHistory = useCallback(() => {
    setPatternHistory([]);
  }, []);

  // Check if specific pattern is available
  const hasPattern = useCallback((patternName) => {
    return patternName.toUpperCase() in HAPTIC_PATTERNS;
  }, []);

  // Get recent patterns
  const getRecentPatterns = useCallback((count = 5) => {
    return patternHistory.slice(-count);
  }, [patternHistory]);

  // Advanced haptic functions
  const hapticUtils = {
    // Success feedback
    success: () => trigger(HAPTIC_PATTERNS.SUCCESS),
    successDouble: () => trigger(HAPTIC_PATTERNS.SUCCESS_DOUBLE),

    // Error feedback
    error: () => trigger(HAPTIC_PATTERNS.ERROR),
    errorGentle: () => trigger(HAPTIC_PATTERNS.ERROR, 0.5),

    // Navigation feedback
    swipe: () => trigger(HAPTIC_PATTERNS.SWIPE),
    navigation: () => trigger(HAPTIC_PATTERNS.NAVIGATION),

    // Selection feedback
    select: () => trigger(HAPTIC_PATTERNS.SELECT),
    deselect: () => trigger(HAPTIC_PATTERNS.DESELECT),

    // Drag and drop feedback
    dragStart: () => trigger(HAPTIC_PATTERNS.DRAG_START),
    dragEnd: () => trigger(HAPTIC_PATTERNS.DRAG_END),
    dropSuccess: () => trigger(HAPTIC_PATTERNS.DROP_SUCCESS),
    dropFail: () => trigger(HAPTIC_PATTERNS.DROP_FAIL),

    // Intensity-based feedback
    gentle: () => trigger(HAPTIC_PATTERNS.GENTLE),
    light: () => trigger(HAPTIC_PATTERNS.LIGHT),
    medium: () => trigger(HAPTIC_PATTERNS.MEDIUM),
    strong: () => trigger(HAPTIC_PATTERNS.STRONG),

    // Custom pattern
    custom: (pattern, intensityLevel = 1) => trigger(pattern, intensityLevel)
  };

  const value = {
    // State
    enabled,
    intensity,
    capabilities,
    patternHistory,

    // Actions
    trigger,
    triggerPattern,
    setEnabled,
    setIntensity,
    getDeviceCapabilities,
    clearHistory,
    hasPattern,
    getRecentPatterns,

    // Utilities
    patterns: HAPTIC_PATTERNS,
    utils: hapticUtils
  };

  return (
    <HapticContext.Provider value={value}>
      {children}
    </HapticContext.Provider>
  );
};

// Convenience hook for common haptic patterns
export const useCommonHaptics = () => {
  const { utils } = useHaptic();
  return utils;
};

export default HapticProvider;