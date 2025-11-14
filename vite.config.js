import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: parseInt(env.VITE_PORT) || 5173,
      allowedHosts: env.VITE_ALLOWED_HOSTS
        ? env.VITE_ALLOWED_HOSTS.split(',').map(host => host.trim())
        : [],
      proxy: {
        '/api': `http://localhost:${env.PORT || 3001}`,
        '/ws': {
          target: `ws://localhost:${env.PORT || 3001}`,
          ws: true,
        },
        '/shell': {
          target: `ws://localhost:${env.PORT || 3001}`,
          ws: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            // React core libraries
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router-dom/') ||
              id.includes('node_modules/scheduler/')
            ) {
              return 'vendor-react';
            }

            // CodeMirror and related packages
            if (
              id.includes('node_modules/@codemirror/') ||
              id.includes('node_modules/@uiw/react-codemirror') ||
              id.includes('node_modules/@replit/codemirror-minimap') ||
              id.includes('node_modules/@lezer/')
            ) {
              return 'vendor-codemirror';
            }

            // XTerm terminal packages
            if (id.includes('node_modules/@xterm/')) {
              return 'vendor-xterm';
            }

            // Markdown rendering and math libraries
            if (
              id.includes('node_modules/react-markdown') ||
              id.includes('node_modules/rehype-') ||
              id.includes('node_modules/remark-') ||
              id.includes('node_modules/katex') ||
              id.includes('node_modules/unified') ||
              id.includes('node_modules/micromark') ||
              id.includes('node_modules/mdast-') ||
              id.includes('node_modules/hast-')
            ) {
              return 'vendor-markdown';
            }

            // Animation libraries
            if (
              id.includes('node_modules/framer-motion') ||
              id.includes('node_modules/@react-spring/') ||
              id.includes('node_modules/@use-gesture/')
            ) {
              return 'vendor-animation';
            }

            // Claude SDK
            if (id.includes('node_modules/@anthropic-ai/')) {
              return 'vendor-claude-sdk';
            }

            // Icons
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-icons';
            }

            // GitHub API client
            if (id.includes('node_modules/@octokit/')) {
              return 'vendor-octokit';
            }

            // Utility libraries
            if (
              id.includes('node_modules/fuse.js') ||
              id.includes('node_modules/jszip') ||
              id.includes('node_modules/pako')
            ) {
              return 'vendor-utils';
            }

            // React component libraries
            if (
              id.includes('node_modules/react-dropzone') ||
              id.includes('node_modules/react-window') ||
              id.includes('node_modules/react-intersection-observer')
            ) {
              return 'vendor-react-components';
            }

            // Other node_modules (catch-all for remaining dependencies)
            if (id.includes('node_modules/')) {
              return 'vendor-misc';
            }
          },
        },
      },
    },
  };
});
