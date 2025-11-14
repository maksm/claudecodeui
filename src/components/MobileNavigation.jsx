import React, { useState, useEffect } from 'react';
import { animated, useSpring } from '@react-spring/web';
import { useResponsiveDesign } from '../hooks/useResponsiveDesign';
import { useHaptic } from '../contexts/HapticContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLocation, useNavigate } from 'react-router-dom';
import MobileToolbar from './MobileToolbar';

const MobileNavigation = ({
  children,
  toolbarProps = {},
  enableSwipeGestures = true,
  className = '',
  ...props
}) => {
  const { isMobile, isTablet, isLandscape } = useResponsiveDesign();
  const { triggerHaptic } = useHaptic();
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState('chat');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // View mapping for navigation
  const viewRoutes = {
    chat: '/chat',
    projects: '/projects',
    shell: '/shell',
    settings: '/settings'
  };

  // Get current view from path
  const getCurrentViewFromPath = (pathname) => {
    const path = pathname.replace(/^\//, '');
    if (!path || path === 'chat') return 'chat';
    if (path === 'projects') return 'projects';
    if (path === 'shell') return 'shell';
    if (path === 'settings') return 'settings';
    return 'chat';
  };

  // Update active view when location changes
  useEffect(() => {
    const view = getCurrentViewFromPath(location.pathname);
    setActiveView(view);
  }, [location.pathname]);

  // Handle navigation
  const handleNavClick = (viewId) => {
    triggerHaptic(30);
    setActiveView(viewId);
    navigate(viewRoutes[viewId]);
  };

  // Handle menu toggle
  const handleMenuClick = () => {
    triggerHaptic(40);
    setIsMenuOpen(!isMenuOpen);
  };

  // Handle settings
  const handleSettingsClick = () => {
    triggerHaptic(30);
    navigate('/settings');
    setIsMenuOpen(false);
  };

  // Handle search
  const handleSearchClick = (query) => {
    triggerHaptic(50);
    // Implement search functionality
    console.log('Search:', query);
  };

  // Handle sidebar toggle
  const handleSidebarToggle = () => {
    triggerHaptic(30);
    setSidebarOpen(!sidebarOpen);
  };

  // Don't render on desktop
  if (!isMobile && !isTablet) {
    return <>{children}</>;
  }

  return (
    <div
      className={`mobile-navigation ${isLandscape ? 'landscape' : 'portrait'} ${sidebarOpen ? 'sidebar-open' : ''} ${className}`}
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: '60px' // Account for toolbar
      }}
      {...props}
    >
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <animated.div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999,
            cursor: 'pointer'
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <animated.div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            width: isLandscape ? '320px' : '280px',
            background: theme === 'dark' ? '#1f2937' : '#ffffff',
            borderRight: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
            zIndex: 1000,
            transform: 'translateX(0)',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {/* Sidebar Header */}
          <div
            style={{
              padding: '16px',
              borderBottom: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <h3 style={{ margin: 0, color: theme === 'dark' ? '#f9fafb' : '#111827' }}>
              Navigation
            </h3>
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                color: theme === 'dark' ? '#9ca3af' : '#6b7280',
                padding: '4px'
              }}
            >
              ×
            </button>
          </div>

          {/* Navigation Items */}
          <div style={{ padding: '16px' }}>
            {Object.entries(viewRoutes).map(([viewId, route]) => (
              <button
                key={viewId}
                onClick={() => {
                  handleNavClick(viewId);
                  setSidebarOpen(false);
                }}
                className={`sidebar-nav-item ${activeView === viewId ? 'active' : ''}`}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: activeView === viewId
                    ? (theme === 'dark' ? '#1e40af' : '#dbeafe')
                    : 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  color: activeView === viewId
                    ? (theme === 'dark' ? '#60a5fa' : '#1e40af')
                    : (theme === 'dark' ? '#f9fafb' : '#111827'),
                  textAlign: 'left',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ fontSize: '20px' }}>
                  {viewId === 'chat' && '💬'}
                  {viewId === 'projects' && '📁'}
                  {viewId === 'shell' && '🖥️'}
                  {viewId === 'settings' && '⚙️'}
                </span>
                <span style={{ textTransform: 'capitalize' }}>
                  {viewId}
                </span>
              </button>
            ))}
          </div>

          {/* Additional sidebar content */}
          <div style={{ padding: '0 16px 16px' }}>
            <button
              onClick={() => {
                handleSidebarToggle();
                // Add more sidebar options
              }}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: theme === 'dark' ? '#374151' : '#f3f4f6',
                border: 'none',
                borderRadius: '8px',
                color: theme === 'dark' ? '#f9fafb' : '#111827',
                textAlign: 'left',
                fontSize: '16px',
                cursor: 'pointer',
                marginBottom: '8px'
              }}
            >
              Recent Projects
            </button>

            <button
              onClick={handleSettingsClick}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: theme === 'dark' ? '#374151' : '#f3f4f6',
                border: 'none',
                borderRadius: '8px',
                color: theme === 'dark' ? '#f9fafb' : '#111827',
                textAlign: 'left',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              Settings
            </button>
          </div>
        </animated.div>
      )}

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'all 0.3s ease'
        }}
      >
        {/* Content wrapper */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          {children}
        </div>
      </div>

      {/* Mobile Toolbar */}
      <MobileToolbar
        onNavClick={handleNavClick}
        onMenuClick={handleMenuClick}
        onSettingsClick={handleSettingsClick}
        onSearchClick={handleSearchClick}
        activeView={activeView}
        {...toolbarProps}
      />

      {/* Menu Overlay */}
      {isMenuOpen && (
        <animated.div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            zIndex: 1001,
            display: 'flex',
            alignItems: 'flex-end',
            cursor: 'pointer'
          }}
          onClick={() => setIsMenuOpen(false)}
        >
          <animated.div
            style={{
              background: theme === 'dark' ? '#1f2937' : '#ffffff',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              padding: '24px',
              cursor: 'default',
              width: '100%',
              maxHeight: '60vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', color: theme === 'dark' ? '#f9fafb' : '#111827' }}>
              Quick Actions
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <button
                onClick={() => {
                  triggerHaptic(30);
                  // Add new project
                  setIsMenuOpen(false);
                }}
                style={{
                  padding: '16px',
                  background: theme === 'dark' ? '#374151' : '#f3f4f6',
                  border: 'none',
                  borderRadius: '12px',
                  color: theme === 'dark' ? '#f9fafb' : '#111827',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span style={{ fontSize: '24px' }}>➕</span>
                <span style={{ fontSize: '12px' }}>New</span>
              </button>

              <button
                onClick={() => {
                  triggerHaptic(30);
                  // Upload file
                  setIsMenuOpen(false);
                }}
                style={{
                  padding: '16px',
                  background: theme === 'dark' ? '#374151' : '#f3f4f6',
                  border: 'none',
                  borderRadius: '12px',
                  color: theme === 'dark' ? '#f9fafb' : '#111827',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span style={{ fontSize: '24px' }}>📤</span>
                <span style={{ fontSize: '12px' }}>Upload</span>
              </button>

              <button
                onClick={() => {
                  triggerHaptic(30);
                  // Help
                  setIsMenuOpen(false);
                }}
                style={{
                  padding: '16px',
                  background: theme === 'dark' ? '#374151' : '#f3f4f6',
                  border: 'none',
                  borderRadius: '12px',
                  color: theme === 'dark' ? '#f9fafb' : '#111827',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span style={{ fontSize: '24px' }}>❓</span>
                <span style={{ fontSize: '12px' }}>Help</span>
              </button>
            </div>
          </animated.div>
        </animated.div>
      )}

      {/* CSS for mobile navigation */}
      <style jsx>{`
        .sidebar-nav-item:hover {
          background: ${theme === 'dark' ? 'rgba(96, 165, 250, 0.1)' : 'rgba(59, 130, 246, 0.1)'};
        }

        .sidebar-nav-item:active {
          transform: scale(0.98);
        }

        /* Landscape adjustments */
        .mobile-navigation.landscape {
          flex-direction: row;
        }

        .mobile-navigation.landscape .sidebar-nav-item {
          font-size: '14px';
        }

        /* Safe area support */
        @supports (padding-top: env(safe-area-inset-top)) {
          .mobile-navigation {
            padding-bottom: calc(60px + env(safe-area-inset-bottom));
          }
        }

        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          .sidebar-nav-item:hover {
            background: rgba(96, 165, 250, 0.15);
          }
        }
      `}</style>
    </div>
  );
};

export default MobileNavigation;