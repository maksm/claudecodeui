import React, { useState, useRef, useEffect } from 'react';
import { animated, useSpring } from '@react-spring/web';
import { useResponsiveDesign } from '../hooks/useResponsiveDesign';
import { useHaptic } from '../contexts/HapticContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';

const MobileToolbar = ({
  onNavClick,
  onMenuClick,
  onSettingsClick,
  onSearchClick,
  activeView = 'chat',
  showSearch = true,
  showMenu = true,
  className = '',
  ...props
}) => {
  const { isMobile, isTablet, getTouchTargetSize } = useResponsiveDesign();
  const { triggerHaptic } = useHaptic();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { isConnected } = useWebSocket();

  const [isExpanded, setIsExpanded] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const toolbarRef = useRef(null);
  const searchInputRef = useRef(null);

  // Animation for toolbar expansion
  const expandAnimation = useSpring({
    height: isExpanded ? 120 : 60,
    opacity: isExpanded ? 1 : 0.9,
    config: { tension: 300, friction: 30 }
  });

  // Animation for search input
  const searchAnimation = useSpring({
    width: searchFocused ? '200px' : '0px',
    opacity: searchFocused ? 1 : 0,
    config: { tension: 200, friction: 20 }
  });

  // Navigation items
  const navItems = [
    { id: 'chat', icon: '💬', label: 'Chat', active: activeView === 'chat' },
    { id: 'projects', icon: '📁', label: 'Projects', active: activeView === 'projects' },
    { id: 'shell', icon: '🖥️', label: 'Terminal', active: activeView === 'shell' },
    { id: 'settings', icon: '⚙️', label: 'Settings', active: activeView === 'settings' }
  ];

  // Handle navigation click
  const handleNavClick = (itemId) => {
    triggerHaptic(30);
    onNavClick?.(itemId);
    setIsExpanded(false);
  };

  // Handle menu click
  const handleMenuClick = () => {
    triggerHaptic(40);
    onMenuClick?.();
    setIsExpanded(!isExpanded);
  };

  // Handle search focus
  const handleSearchFocus = () => {
    setSearchFocused(true);
    triggerHaptic(20);
  };

  // Handle search blur
  const handleSearchBlur = () => {
    setSearchFocused(false);
    setSearchValue('');
  };

  // Handle search submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchValue.trim()) {
      triggerHaptic(50);
      onSearchClick?.(searchValue);
      setSearchValue('');
      searchInputRef.current?.blur();
    }
  };

  // Click outside to close expanded toolbar
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isExpanded]);

  // Don't render on desktop
  if (!isMobile && !isTablet) {
    return null;
  }

  return (
    <animated.div
      ref={toolbarRef}
      className={`mobile-toolbar ${isExpanded ? 'expanded' : ''} ${className}`}
      style={{
        ...expandAnimation,
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: theme === 'dark' ? '#1f2937' : '#ffffff',
        borderTop: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.3s ease'
      }}
      {...props}
    >
      {/* Main toolbar row */}
      <div className="toolbar-main">
        {/* Navigation items */}
        <div className="toolbar-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`toolbar-nav-item ${item.active ? 'active' : ''}`}
              style={{
                minHeight: `${getTouchTargetSize()}px`,
                minWidth: `${getTouchTargetSize()}px`,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                color: item.active ? (theme === 'dark' ? '#60a5fa' : '#3b82f6') : (theme === 'dark' ? '#9ca3af' : '#6b7280'),
                fontSize: '20px',
                padding: '4px',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.2s ease'
              }}
            >
              <span>{item.icon}</span>
              <span
                style={{
                  fontSize: '10px',
                  marginTop: '2px',
                  fontWeight: '500'
                }}
              >
                {item.label}
              </span>
              {item.active && (
                <div
                  style={{
                    position: 'absolute',
                    top: '0',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '20px',
                    height: '2px',
                    background: theme === 'dark' ? '#60a5fa' : '#3b82f6',
                    borderRadius: '1px'
                  }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Right side actions */}
        <div className="toolbar-actions">
          {/* Search */}
          {showSearch && (
            <animated.div
              style={{
                ...searchAnimation,
                marginRight: searchFocused ? '8px' : '0',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onFocus={handleSearchFocus}
                  onBlur={handleSearchBlur}
                  placeholder="Search..."
                  className="toolbar-search"
                  style={{
                    width: '100%',
                    height: '36px',
                    padding: '0 12px',
                    border: `1px solid ${theme === 'dark' ? '#4b5563' : '#d1d5db'}`,
                    borderRadius: '18px',
                    background: theme === 'dark' ? '#374151' : '#f9fafb',
                    color: theme === 'dark' ? '#f9fafb' : '#111827',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </form>
            </animated.div>
          )}

          {/* Search button (when not focused) */}
          {showSearch && !searchFocused && (
            <button
              onClick={handleSearchFocus}
              className="toolbar-action-btn"
              style={{
                minHeight: `${getTouchTargetSize()}px`,
                minWidth: `${getTouchTargetSize()}px`,
                background: 'transparent',
                border: 'none',
                color: theme === 'dark' ? '#9ca3af' : '#6b7280',
                cursor: 'pointer',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </button>
          )}

          {/* Connection status */}
          <div
            className="toolbar-status"
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isConnected ? '#10b981' : '#ef4444',
              margin: '0 8px'
            }}
          />

          {/* Menu button */}
          {showMenu && (
            <button
              onClick={handleMenuClick}
              className="toolbar-action-btn"
              style={{
                minHeight: `${getTouchTargetSize()}px`,
                minWidth: `${getTouchTargetSize()}px`,
                background: 'transparent',
                border: 'none',
                color: theme === 'dark' ? '#9ca3af' : '#6b7280',
                cursor: 'pointer',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)',
                transition: 'transform 0.3s ease'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Expanded toolbar content */}
      {isExpanded && (
        <div className="toolbar-expanded" style={{ padding: '12px' }}>
          {/* User info */}
          {user && (
            <div
              className="toolbar-user"
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 12px',
                background: theme === 'dark' ? '#374151' : '#f3f4f6',
                borderRadius: '8px',
                marginBottom: '8px'
              }}
            >
              <div
                className="user-avatar"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: theme === 'dark' ? '#4b5563' : '#d1d5db',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: theme === 'dark' ? '#f9fafb' : '#111827',
                  fontSize: '14px',
                  fontWeight: '600',
                  marginRight: '8px'
                }}
              >
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: theme === 'dark' ? '#f9fafb' : '#111827' }}>
                  {user.username}
                </div>
                <div style={{ fontSize: '12px', color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                  {user.email}
                </div>
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="toolbar-quick-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                triggerHaptic(30);
                onSettingsClick?.();
                setIsExpanded(false);
              }}
              className="quick-action-btn"
              style={{
                padding: '8px 16px',
                background: theme === 'dark' ? '#4b5563' : '#e5e7eb',
                border: 'none',
                borderRadius: '20px',
                color: theme === 'dark' ? '#f9fafb' : '#111827',
                fontSize: '12px',
                cursor: 'pointer',
                minHeight: '32px'
              }}
            >
              Settings
            </button>

            <button
              onClick={() => {
                triggerHaptic(30);
                // Add logout or other quick action
              }}
              className="quick-action-btn"
              style={{
                padding: '8px 16px',
                background: theme === 'dark' ? '#4b5563' : '#e5e7eb',
                border: 'none',
                borderRadius: '20px',
                color: theme === 'dark' ? '#f9fafb' : '#111827',
                fontSize: '12px',
                cursor: 'pointer',
                minHeight: '32px'
              }}
            >
              Help
            </button>
          </div>
        </div>
      )}

      {/* CSS styles */}
      <style jsx>{`
        .toolbar-nav {
          display: flex;
          flex: 1;
          max-width: 400px;
          margin: 0 auto;
        }

        .toolbar-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .toolbar-nav-item:hover {
          background: ${theme === 'dark' ? 'rgba(96, 165, 250, 0.1)' : 'rgba(59, 130, 246, 0.1)'};
        }

        .toolbar-nav-item:active {
          transform: scale(0.95);
        }

        .toolbar-search:focus {
          outline: 2px solid ${theme === 'dark' ? '#60a5fa' : '#3b82f6'};
          outline-offset: -2px;
        }

        .toolbar-action-btn:hover {
          background: ${theme === 'dark' ? 'rgba(156, 163, 175, 0.1)' : 'rgba(107, 114, 128, 0.1)'};
        }

        .toolbar-action-btn:active {
          transform: scale(0.95);
        }

        .quick-action-btn:hover {
          background: ${theme === 'dark' ? '#6b7280' : '#d1d5db'};
        }

        .quick-action-btn:active {
          transform: scale(0.95);
        }

        /* Dark mode adjustments */
        @media (prefers-color-scheme: dark) {
          .toolbar-search::placeholder {
            color: #9ca3af;
          }
        }
      `}</style>
    </animated.div>
  );
};

export default MobileToolbar;