/* global Worker */
import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * React hook for using the markdown processing web worker
 * Prevents UI blocking during markdown rendering
 */

const useMarkdownWorker = (options = {}) => {
  const {
    workerUrl = '/markdown-worker.js',
    enableCache = true,
    timeout = 10000,
    maxConcurrent = 3
  } = options;

  const [isReady, setIsReady] = useState(false);
  const [processing, setProcessing] = useState(new Set());
  const [cacheStats, setCacheStats] = useState({});

  const workerRef = useRef(null);
  const messageIdRef = useRef(0);
  const pendingRequests = useRef(new Map());

  // Handle successful processing
  const handleProcessingResult = useCallback((id, data) => {
    const request = pendingRequests.current.get(id);
    if (request) {
      request.resolve(data);
      pendingRequests.current.delete(id);
      setProcessing(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  }, []);

  // Handle processing errors
  const handleProcessingError = useCallback((id, error) => {
    const request = pendingRequests.current.get(id);
    if (request) {
      request.reject(new Error(error.error || 'Markdown processing failed'));
      pendingRequests.current.delete(id);
      setProcessing(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  }, []);

  // Handle worker messages
  const handleWorkerMessage = useCallback((event) => {
    const { id, type, data } = event.data;

    switch (type) {
      case 'result':
        handleProcessingResult(id, data);
        break;
      case 'error':
        handleProcessingError(id, data);
        break;
      case 'configured':
        setCacheStats(data);
        break;
      case 'cacheCleared':
        setCacheStats(data);
        break;
      default:
        console.log('Unknown worker message:', type, data);
    }
  }, [handleProcessingResult, handleProcessingError]);

  // Handle worker errors
  const handleWorkerError = useCallback((error) => {
    console.error('Markdown worker error:', error);

    // Reject all pending requests
    pendingRequests.current.forEach(({ reject }) => {
      reject(new Error(`Worker error: ${error.message}`));
    });
    pendingRequests.current.clear();
    setProcessing(new Set());
  }, []);

  // Initialize worker
  useEffect(() => {
    const worker = new Worker(workerUrl);
    workerRef.current = worker;

    worker.onmessage = handleWorkerMessage;
    worker.onerror = handleWorkerError;

    // Configure worker
    worker.postMessage({
      type: 'configure',
      data: {
        enableCache,
        cacheSize: 1000,
        markedOptions: {
          highlight: true,
          breaks: true,
          gfm: true,
          sanitize: false,
          smartLists: true,
          smartypants: true
        }
      }
    });

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsReady(true);

    return () => {
      if (worker) {
        worker.terminate();
      }
    };
  }, [workerUrl, enableCache, handleWorkerMessage, handleWorkerError]);

  // Process markdown content
  const processMarkdown = useCallback(async (content, options = {}) => {
    if (!isReady) {
      throw new Error('Worker not ready');
    }

    if (processing.size >= maxConcurrent) {
      throw new Error('Too many concurrent requests');
    }

    return new Promise((resolve, reject) => {
      const id = ++messageIdRef.current;
      const timeoutId = setTimeout(() => {
        const request = pendingRequests.current.get(id);
        if (request) {
          reject(new Error('Processing timeout'));
          pendingRequests.current.delete(id);
          setProcessing(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
          });
        }
      }, timeout);

      // Store request handler
      pendingRequests.current.set(id, {
        resolve,
        reject,
        timeout: timeoutId
      });

      // Add to processing set
      setProcessing(prev => new Set(prev).add(id));

      // Send to worker
      workerRef.current.postMessage({
        id,
        type: 'process',
        data: {
          content,
          options
        }
      });
    });
  }, [isReady, processing.size, maxConcurrent, timeout]);

  // Utility function to escape HTML
  const escapeHtml = useCallback((text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }, []);

  // Batch process multiple markdown content
  const processBatch = useCallback(async (contents, options = {}) => {
    if (!isReady) {
      throw new Error('Worker not ready');
    }

    const results = [];
    const promises = contents.map((content, index) =>
      processMarkdown(content, { ...options, index })
    );

    try {
      const resolvedResults = await Promise.all(promises);
      return resolvedResults;
    } catch (error) {
      // Partial success is better than complete failure
      const resolved = await Promise.allSettled(promises);
      return resolved.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          // Fallback to plain text processing
          return {
            html: `<pre>${escapeHtml(contents[index])}</pre>`,
            metadata: {
              wordCount: contents[index].split(/\s+/).length,
              lineCount: contents[index].split('\n').length,
              charCount: contents[index].length,
              codeBlocks: 0,
              codeLanguages: [],
              linkCount: 0,
              imageCount: 0,
              processedAt: new Date().toISOString()
            },
            cached: false,
            processingTime: 0,
            error: true
          };
        }
      });
    }
  }, [isReady, processMarkdown, escapeHtml]);

  // Clear worker cache
  const clearCache = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'clearCache'
      });
    }
  }, []);

  // Get worker statistics
  const getStats = useCallback(() => ({
    isReady,
    processingCount: processing.size,
    pendingRequestsCount: pendingRequests.current.length,
    cacheStats,
    workerUrl
  }), [isReady, processing.size, cacheStats, workerUrl]);

  return {
    // State
    isReady,
    processing: processing.size > 0,
    processingCount: processing.size,

    // Methods
    processMarkdown,
    processBatch,

    // Utilities
    clearCache,
    getStats,

    // Advanced
    flushQueue: () => {
      // Cancel all pending requests
      pendingRequests.current.forEach(({ reject }) => {
        reject(new Error('Request cancelled'));
      });
      pendingRequests.current.clear();
      setProcessing(new Set());
    }
  };
};

export default useMarkdownWorker;