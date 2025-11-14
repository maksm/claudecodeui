import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useMarkdownWorker } from '../hooks/useMarkdownWorker';
import { Eye, FileText, Copy, Download, Maximize2, Minimize2, Loader2 } from 'lucide-react';

/**
 * Optimized Markdown Preview component using web workers
 * Processes markdown in background threads to prevent UI blocking
 * Includes caching and performance optimizations
 */
const OptimizedMarkdownPreview = ({
  content,
  filename = 'README.md',
  showControls = true,
  onTogglePreview,
  onCopy,
  onDownload,
  className = '',
  ...props
}) => {
  const { theme } = useTheme();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Use markdown worker for processing
  const {
    processMarkdown,
    isReady,
    error: workerError,
    getCacheStats,
    clearCache,
  } = useMarkdownWorker({
    cacheSize: 100,
    enableCache: true,
  });

  // Process markdown content with worker
  const { processedContent, isProcessing, error } = useMemo(() => {
    if (!content || !isReady) {
      return { processedContent: '', isProcessing: false, error: null };
    }

    let mounted = true;
    const processContent = async () => {
      try {
        const result = await processMarkdown(content, {
          enableGfm: true,
          enableMath: false, // Disable math for performance unless needed
          enableHighlight: true,
          enableSanitization: true,
        });

        if (mounted && result.html) {
          return { processedContent: result.html, isProcessing: false, error: null };
        }
      } catch (err) {
        console.error('Markdown processing error:', err);
        if (mounted) {
          return { processedContent: '', isProcessing: false, error: err.message };
        }
      }
      return { processedContent: '', isProcessing: false, error: null };
    };

    // For now, return empty state and trigger processing
    processContent();

    return { processedContent: '', isProcessing: true, error: null };
  }, [content, isReady, processMarkdown]);

  // State for processed content
  const [htmlContent, setHtmlContent] = useState('');
  const [processingState, setProcessingState] = useState({ isProcessing: false, error: null });

  // Process markdown when content changes
  useEffect(() => {
    if (!content || !isReady) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHtmlContent('');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProcessingState({ isProcessing: false, error: null });
      return;
    }

    let isMounted = true;
    let debounceTimer;

    const processContent = async () => {
      try {
        setProcessingState({ isProcessing: true, error: null });

        // Debounce processing to avoid excessive worker calls
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const result = await processMarkdown(content, {
            enableGfm: true,
            enableMath: false,
            enableHighlight: true,
            enableSanitization: true,
          });

          if (isMounted && result.html) {
            setHtmlContent(result.html);
            setProcessingState({ isProcessing: false, error: null });
          }
        }, 300); // 300ms debounce
      } catch (err) {
        console.error('Markdown processing error:', err);
        if (isMounted) {
          setProcessingState({ isProcessing: false, error: err.message });
          setHtmlContent('');
        }
      }
    };

    processContent();

    return () => {
      isMounted = false;
      clearTimeout(debounceTimer);
    };
  }, [content, isReady, processMarkdown]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.();
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onDownload?.();
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Calculate content statistics
  const contentStats = useMemo(() => {
    if (!content) return { words: 0, lines: 0, chars: 0 };
    return {
      words: content.split(/\s+/).filter(word => word.length > 0).length,
      lines: content.split('\n').length,
      chars: content.length,
    };
  }, [content]);

  // Render HTML content safely
  const renderHtmlContent = () => {
    if (processingState.isProcessing) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span>Processing markdown...</span>
          </div>
        </div>
      );
    }

    if (processingState.error) {
      return (
        <div className="flex items-center justify-center h-64 text-red-500 dark:text-red-400">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="text-lg font-medium">Markdown Processing Error</div>
            <div className="text-sm opacity-75">{processingState.error}</div>
            <button
              onClick={() => setProcessingState({ isProcessing: false, error: null })}
              className="px-3 py-1 bg-red-100 dark:bg-red-900/20 rounded text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    if (!htmlContent) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <div>No content to preview</div>
          </div>
        </div>
      );
    }

    return (
      <div
        className="prose prose-gray dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:mb-4 prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-pre:border prose-pre:border-gray-200 dark:prose-pre:border-gray-700"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
        style={{
          // Custom styles for better markdown rendering
          color: theme === 'dark' ? '#f9fafb' : '#111827',
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
        }}
      />
    );
  };

  const previewContent = (
    <div className={`flex flex-col h-full ${className}`} {...props}>
      {/* Controls */}
      {showControls && (
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Preview: {filename}
              </span>
              {processingState.isProcessing && (
                <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {contentStats.words} words • {contentStats.lines} lines •{' '}
              {contentStats.chars.toLocaleString()} chars
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              disabled={processingState.isProcessing}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={copied ? 'Copied!' : 'Copy content'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {copied ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                  />
                )}
              </svg>
            </button>

            <button
              onClick={handleDownload}
              disabled={processingState.isProcessing}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Download markdown"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={toggleFullscreen}
              className="hidden md:flex p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 items-center justify-center"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {onTogglePreview && (
              <button
                onClick={onTogglePreview}
                className="p-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                title="Switch to edit mode"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
            )}

            {/* Debug button for cache stats (development only) */}
            {process.env.NODE_ENV === 'development' && (
              <button
                onClick={() => {
                  const stats = getCacheStats();
                  console.log('Markdown Worker Cache Stats:', stats);
                  clearCache();
                }}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded text-xs"
                title="Clear cache (dev)"
              >
                🗑️
              </button>
            )}
          </div>
        </div>
      )}

      {/* Preview Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">{renderHtmlContent()}</div>
      </div>

      {/* Performance indicator */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-2 right-2 text-xs text-gray-400 dark:text-gray-500 bg-black/5 px-2 py-1 rounded">
          {processingState.isProcessing ? 'Processing...' : 'Web Worker'}
        </div>
      )}
    </div>
  );

  if (isFullscreen) {
    return <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">{previewContent}</div>;
  }

  return previewContent;
};

export default OptimizedMarkdownPreview;
