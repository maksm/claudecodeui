import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { useTheme } from '../contexts/ThemeContext';

// Message height calculator
const MESSAGE_HEIGHTS = {
  small: 80,    // Short text messages
  medium: 120,  // Average text messages
  large: 200,   // Long text or code blocks
  system: 60,  // System messages
  file: 140,   // File attachments
  image: 200   // Image messages
};

// Message row component
const MessageRow = ({ index, style, data }) => {
  const { messages, theme, activeMessageId, onMessageClick, onMessageHover } = data;
  const message = messages[index];

  if (!message) {
    return <div style={style} />;
  }

  const isActive = message.id === activeMessageId;
  const messageHeight = getMessageHeight(message);

  return (
    <div
      style={{
        ...style,
        height: messageHeight,
        padding: '8px 16px',
        borderBottom: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
        background: isActive
          ? (theme === 'dark' ? '#1e40af' : '#dbeafe')
          : (theme === 'dark' ? '#111827' : '#ffffff')
      }}
      className={`message-row ${isActive ? 'active' : ''}`}
      onMouseEnter={() => onMessageHover?.(message.id)}
      onMouseLeave={() => onMessageHover?.(null)}
      onClick={() => onMessageClick?.(message.id)}
    >
      {/* Message content */}
      <div className="message-content" style={{ marginBottom: '8px' }}>
        {message.content && (
          <div
            style={{
              fontSize: '14px',
              lineHeight: '1.5',
              color: theme === 'dark' ? '#f9fafb' : '#111827',
              wordWrap: 'break-word',
              whiteSpace: 'pre-wrap'
            }}
          >
            {message.content}
          </div>
        )}
      </div>

      {/* Message metadata */}
      <div className="message-meta" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '12px',
        color: theme === 'dark' ? '#9ca3af' : '#6b7280'
      }}>
        <span>
          {message.sender && `${message.sender} • `}
          {formatTime(message.timestamp)}
        </span>
        {message.id && (
          <span className="message-id" style={{ fontFamily: 'monospace' }}>
            #{message.id.slice(-6)}
          </span>
        )}
      </div>

      {/* File attachment */}
      {message.attachment && (
        <div className="message-attachment" style={{
          marginTop: '8px',
          padding: '8px',
          background: theme === 'dark' ? '#374151' : '#f3f4f6',
          borderRadius: '8px',
          fontSize: '12px'
        }}>
          📎 {message.attachment.name}
          {message.attachment.size && ` (${formatFileSize(message.attachment.size)})`}
        </div>
      )}

      {/* System message styling */}
      {message.type === 'system' && (
        <div style={{
          fontStyle: 'italic',
          textAlign: 'center',
          color: theme === 'dark' ? '#9ca3af' : '#6b7280'
        }}>
          {message.content}
        </div>
      )}

      <style>{`
        .message-row:hover {
          cursor: pointer;
          background: ${isActive
            ? (theme === 'dark' ? '#1e40af' : '#dbeafe')
            : (theme === 'dark' ? '#1f2937' : '#f9fafb')
          };
        }
      `}</style>
    </div>
  );
};

// Calculate message height based on content
const getMessageHeight = (message) => {
  if (!message || !message.content) return MESSAGE_HEIGHTS.system;

  const contentLength = message.content.length;
  const hasCodeBlock = /```/.test(message.content);
  const hasFile = message.attachment;
  const hasImage = message.attachment?.type?.startsWith('image/');

  if (message.type === 'system') {
    return MESSAGE_HEIGHTS.system;
  }

  if (hasImage) {
    return MESSAGE_HEIGHTS.image;
  }

  if (hasFile) {
    return MESSAGE_HEIGHTS.file;
  }

  if (hasCodeBlock) {
    return MESSAGE_HEIGHTS.large;
  }

  if (contentLength > 500) {
    return MESSAGE_HEIGHTS.large;
  }

  if (contentLength > 100) {
    return MESSAGE_HEIGHTS.medium;
  }

  return MESSAGE_HEIGHTS.small;
};

// Format timestamp
const formatTime = (timestamp) => {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;

  if (diffMs < 60000) {
    return 'just now';
  } else if (diffMs < 3600000) {
    return `${Math.floor(diffMs / 60000)}m ago`;
  } else if (diffMs < 86400000) {
    return `${Math.floor(diffMs / 3600000)}h ago`;
  } else {
    return date.toLocaleDateString();
  }
};

// Format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Main VirtualizedMessageList component
const VirtualizedMessageList = ({
  messages = [],
  loading = false,
  hasNextPage = false,
  loadNextPage = () => {},
  onMessageClick,
  onMessageHover,
  activeMessageId = null,
  className = '',
  containerProps = {},
  ...props
}) => {
  const { theme } = useTheme();

  // Ref for the List component
  const listRef = useRef(null);

  // Memoized data for performance
  const listData = useMemo(() => ({
    messages,
    theme,
    activeMessageId,
    onMessageClick,
    onMessageHover
  }), [messages, theme, activeMessageId, onMessageClick, onMessageHover]);

  // Calculate total item count including loading indicator
  const itemCount = messages.length + (loading ? 1 : 0);

  // Infinite loader configuration
  const isItemLoaded = useCallback((index) => {
    return !loading || index < messages.length;
  }, [loading, messages.length]);

  const loadMoreItems = useCallback(() => {
    if (!loading && hasNextPage) {
      loadNextPage();
    }
  }, [loading, hasNextPage, loadNextPage]);

  // Scroll to message by ID
  const scrollToMessage = useCallback((messageId) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex !== -1 && listRef.current) {
      listRef.current.scrollToItem(messageIndex, 'center');
    }
  }, [messages]);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(messages.length - 1);
    }
  }, [messages.length]);

  // Get scroll position
  const getScrollInfo = useCallback(() => {
    if (!listRef.current) return null;
    return listRef.current._outerRef;
  }, []);

  // Check if scrolled to bottom
  const isAtBottom = useCallback(() => {
    const scrollInfo = getScrollInfo();
    if (!scrollInfo) return true;
    return scrollInfo.scrollTop >= scrollInfo.scrollHeight - scrollInfo.clientHeight - 100;
  }, [getScrollInfo]);

  // Auto-scroll to bottom when new messages arrive
  const shouldAutoScroll = useRef(true);
  const [userScrolled, setUserScrolled] = useState(false);

  useEffect(() => {
    if (shouldAutoScroll.current && !userScrolled) {
      const timer = setTimeout(() => {
        scrollToBottom();
        shouldAutoScroll.current = true;
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [messages.length, scrollToBottom, userScrolled]);

  // Handle scroll events to detect user scrolling
  const handleScroll = useCallback(() => {
    const atBottom = isAtBottom();
    if (atBottom) {
      setUserScrolled(false);
      shouldAutoScroll.current = true;
    } else {
      setUserScrolled(true);
      shouldAutoScroll.current = false;
    }
  }, [isAtBottom]);

  // Expose methods via ref
  React.useImperativeHandle(props.ref, () => ({
    scrollToMessage,
    scrollToBottom,
    getScrollInfo,
    isAtBottom,
    getListRef: () => listRef.current
  }), [scrollToMessage, scrollToBottom, getScrollInfo, isAtBottom]);

  // Item key generator
  const itemKey = useCallback((index) => {
    const message = messages[index];
    return message ? `message-${message.id}` : `loading-${index}`;
  }, [messages]);

  // Item size function for variable height (if needed in future)
  const itemSize = useCallback((index) => {
    const message = messages[index];
    return getMessageHeight(message);
  }, [messages]);

  if (messages.length === 0 && !loading) {
    return (
      <div
        className={`virtualized-message-list empty ${className}`}
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme === 'dark' ? '#9ca3af' : '#6b7280',
          fontSize: '16px'
        }}
        {...props}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
          <div>No messages yet</div>
          <div style={{ fontSize: '14px', marginTop: '8px' }}>
            Start a conversation to see messages here
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`virtualized-message-list ${className}`}
      style={{
        height: '100%',
        position: 'relative'
      }}
      {...props}
    >
      <InfiniteLoader
        isItemLoaded={isItemLoaded}
        itemCount={itemCount}
        loadMoreItems={loadMoreItems}
      >
        {({ onItemsRendered, ref }) => (
          <List
            ref={(list) => {
              // Forward ref to both components
              if (typeof ref === 'function') ref(list);
              listRef.current = list;

              // Attach scroll listener
              if (list) {
                const outerDiv = list._outerRef;
                if (outerDiv) {
                  outerDiv.addEventListener('scroll', handleScroll);
                  return () => {
                    outerDiv.removeEventListener('scroll', handleScroll);
                  };
                }
              }
            }}
            height="100%"
            itemCount={itemCount}
            itemSize={itemSize}
            itemData={listData}
            onItemsRendered={onItemsRendered}
            itemKey={itemKey}
            overscanCount={5}
            overscanSize={100}
            {...containerProps}
          >
            {MessageRow}
          </List>
        )}
      </InfiniteLoader>
    </div>
  );
};

export default React.forwardRef(VirtualizedMessageList);