/**
 * Markdown Worker
 * Processes markdown content in a web worker to prevent UI blocking
 */

// Import libraries that will be injected
importScripts('https://cdn.jsdelivr.net/npm/marked/marked.min.js');
importScripts('https://cdn.jsdelivr.net/npm/prismjs/prism.min.js');
importScripts('https://cdn.jsdelivr.net/npm/prismjs/components/prism-javascript.min.js');
importScripts('https://cdn.jsdelivr.net/npm/prismjs/components/prism-typescript.min.js');
importScripts('https://cdn.jsdelivr.net/npm/prismjs/components/prism-python.min.js');
importScripts('https://cdn.jsdelivr.net/npm/prismjs/components/prism-java.min.js');
importScripts('https://cdn.jsdelivr.net/npm/prismjs/components/prism-cpp.min.js');
importScripts('https://cdn.jsdelivr.net/npm/prismjs/components/prism-json.min.js');
importScripts('https://cdn.jsdelivr.net/npm/prismjs/components/prism-sql.min.js');
importScripts('https://cdn.jsdelivr.net/npm/prismjs/components/prism-bash.min.js');
importScripts('https://cdn.jsdelivr.net/npm/prismjs/components/prism-css.min.js');
importScripts('https://cdn.jsdelivr.net/npm/prismjs/components/prism-yaml.min.js');

// Configure marked options
marked.setOptions({
  highlight: function (code, lang) {
    if (Prism.languages[lang]) {
      return Prism.highlight(code, Prism.languages[lang]);
    }
    return code;
  },
  breaks: true,
  gfm: true,
  sanitize: false,
  smartLists: true,
  smartypants: true,
  xhtml: true,
});

// Cache for processed markdown
const cache = new Map();
const MAX_CACHE_SIZE = 1000;

// Worker message handler
self.onmessage = function (e) {
  const { id, type, data } = e.data;

  switch (type) {
    case 'process':
      processMarkdown(id, data);
      break;
    case 'configure':
      configureWorker(data);
      break;
    case 'clearCache':
      clearCache();
      break;
    default:
      console.warn('Unknown message type:', type);
  }
};

/**
 * Process markdown content
 */
function processMarkdown(id, { content, options = {} }) {
  try {
    const startTime = performance.now();

    // Check cache first
    const cacheKey = generateCacheKey(content, options);
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      self.postMessage({
        id,
        type: 'result',
        data: {
          html: cached.html,
          metadata: cached.metadata,
          cached: true,
          processingTime: performance.now() - startTime,
        },
      });
      return;
    }

    // Process markdown
    const html = marked.parse(content, {
      ...options,
      async: false, // Use sync mode in worker
    });

    // Generate metadata
    const metadata = generateMetadata(content, html);

    // Cache result
    if (cache.size >= MAX_CACHE_SIZE) {
      // Remove oldest entry
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    cache.set(cacheKey, { html, metadata });

    self.postMessage({
      id,
      type: 'result',
      data: {
        html,
        metadata,
        cached: false,
        processingTime: performance.now() - startTime,
      },
    });
  } catch (error) {
    self.postMessage({
      id,
      type: 'error',
      data: {
        error: error.message,
        stack: error.stack,
      },
    });
  }
}

/**
 * Generate cache key for content
 */
function generateCacheKey(content, options) {
  const optionsHash = JSON.stringify(options);
  return `${content.length}_${btoa(content).slice(0, 50)}_${optionsHash}`;
}

/**
 * Generate metadata about the processed content
 */
function generateMetadata(content, html) {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const lineCount = content.split('\n').length;
  const charCount = content.length;

  // Extract code blocks
  const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
  const codeLanguages = codeBlocks.map(block => {
    const match = block.match(/```(\w+)/);
    return match ? match[1] : 'text';
  });

  // Extract links
  const links = content.match(/https?:\/\/[^\s)]+/g) || [];
  const imageLinks = content.match(/!\[.*?\]\(https?:\/\/[^\s)]+\)/g) || [];

  return {
    wordCount,
    lineCount,
    charCount,
    codeBlocks: codeBlocks.length,
    codeLanguages: [...new Set(codeLanguages)],
    linkCount: links.length,
    imageCount: imageLinks.length,
    processedAt: new Date().toISOString(),
  };
}

/**
 * Configure worker settings
 */
function configureWorker(settings) {
  if (settings.cacheSize) {
    // Adjust cache size if needed
    while (cache.size > settings.cacheSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
  }

  // Update marked options if provided
  if (settings.markedOptions) {
    marked.setOptions({
      ...marked.getDefaults(),
      ...settings.markedOptions,
    });
  }

  self.postMessage({
    type: 'configured',
    data: {
      cacheSize: cache.size,
      settings,
    },
  });
}

/**
 * Clear cache
 */
function clearCache() {
  cache.clear();
  self.postMessage({
    type: 'cacheCleared',
    data: {
      cacheSize: 0,
    },
  });
}
