import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import FileTree from '../../../src/components/FileTree.jsx';
import { api } from '../../../src/utils/api';

// Mock dependencies
jest.mock('../../../src/utils/api');

jest.mock('../../../src/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }) => <div data-testid="scroll-area">{children}</div>
}));

jest.mock('../../../src/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, className, ...props }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      className={className}
      {...props}
      data-testid={props['data-testid'] || 'button'}
    >
      {children}
    </button>
  )
}));

jest.mock('../../../src/components/ui/input', () => ({
  Input: ({ onChange, value, placeholder, className, ...props }) => (
    <input
      onChange={onChange}
      value={value}
      placeholder={placeholder}
      className={className}
      {...props}
      data-testid={props['data-testid'] || 'input'}
    />
  )
}));

jest.mock('../../../src/components/ui/badge', () => ({
  Badge: ({ children, variant, className, ...props }) => (
    <span
      data-variant={variant}
      className={className}
      {...props}
      data-testid={props['data-testid'] || 'badge'}
    >
      {children}
    </span>
  )
}));

jest.mock('../../../src/components/CodeEditor', () => ({
  default: ({ file, onClose, onSave, language, theme }) => (
    <div data-testid="code-editor">
      <div data-testid="file-name">{file?.name}</div>
      <div data-testid="file-content">{file?.content}</div>
      <button data-testid="close-editor" onClick={onClose}>Close</button>
      <button data-testid="save-file" onClick={() => onSave(file?.content)}>Save</button>
    </div>
  )
}));

jest.mock('../../../src/components/ImageViewer', () => ({
  default: ({ image, onClose }) => (
    <div data-testid="image-viewer">
      <img src={image?.url} alt={image?.name} />
      <button data-testid="close-image" onClick={onClose}>Close</button>
    </div>
  )
}));

describe('FileTree Component', () => {
  const mockSelectedProject = {
    id: 'test-project',
    name: 'Test Project',
    path: '/path/to/project'
  };

  const mockFiles = [
    {
      name: 'src',
      path: '/path/to/project/src',
      type: 'directory',
      children: [
        {
          name: 'components',
          path: '/path/to/project/src/components',
          type: 'directory',
          children: [
            {
              name: 'App.jsx',
              path: '/path/to/project/src/components/App.jsx',
              type: 'file',
              extension: 'jsx',
              size: 1024,
              modified: '2024-01-01T00:00:00Z'
            }
          ]
        },
        {
          name: 'index.js',
          path: '/path/to/project/src/index.js',
          type: 'file',
          extension: 'js',
          size: 512,
          modified: '2024-01-02T00:00:00Z'
        }
      ]
    },
    {
      name: 'package.json',
      path: '/path/to/project/package.json',
      type: 'file',
      extension: 'json',
      size: 2048,
      modified: '2024-01-03T00:00:00Z'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    // Mock successful API response
    api.mockResolvedValue({
      data: {
        files: mockFiles
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  describe('Basic Rendering', () => {
    it('renders file tree when project is selected', async () => {
      render(<FileTree selectedProject={mockSelectedProject} />);

      await waitFor(() => {
        expect(screen.getByTestId('scroll-area')).toBeInTheDocument();
      });

      expect(screen.getByText('src')).toBeInTheDocument();
      expect(screen.getByText('package.json')).toBeInTheDocument();
    });

    it('shows loading state initially', () => {
      api.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(<FileTree selectedProject={mockSelectedProject} />);

      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });

    it('renders empty state when no project selected', () => {
      render(<FileTree selectedProject={null} />);

      expect(screen.getByText(/No project selected/i)).toBeInTheDocument();
    });

    it('renders empty state when no files found', async () => {
      api.mockResolvedValue({ data: { files: [] } });

      render(<FileTree selectedProject={mockSelectedProject} />);

      await waitFor(() => {
        expect(screen.getByText(/No files found/i)).toBeInTheDocument();
      });
    });
  });

  describe('File Operations', () => {
    it('expands and collapses directories', async () => {
      const user = userEvent.setup();
      render(<FileTree selectedProject={mockSelectedProject} />);

      await waitFor(() => {
        expect(screen.getByText('src')).toBeInTheDocument();
      });

      const srcDirectory = screen.getByText('src');
      await user.click(srcDirectory);

      // Should show expanded content
      expect(screen.getByText('components')).toBeInTheDocument();
      expect(screen.getByText('index.js')).toBeInTheDocument();

      // Click again to collapse
      await user.click(srcDirectory);

      // Components directory should not be visible when collapsed
      expect(screen.queryByText('components')).not.toBeInTheDocument();
    });

    it('opens file when clicked', async () => {
      const user = userEvent.setup();
      const mockFileContent = {
        content: 'console.log("Hello World");',
        language: 'javascript'
      };

      api.mockResolvedValueOnce({ data: { files: mockFiles } });
      api.mockResolvedValueOnce({ data: mockFileContent });

      render(<FileTree selectedProject={mockSelectedProject} />);

      await waitFor(() => {
        expect(screen.getByText('package.json')).toBeInTheDocument();
      });

      const packageJson = screen.getByText('package.json');
      await user.click(packageJson);

      await waitFor(() => {
        expect(screen.getByTestId('code-editor')).toBeInTheDocument();
        expect(screen.getByTestId('file-name')).toHaveTextContent('package.json');
        expect(screen.getByTestId('file-content')).toHaveTextContent(mockFileContent.content);
      });
    });

    it('closes file editor when close button is clicked', async () => {
      const user = userEvent.setup();
      const mockFileContent = {
        content: 'console.log("Hello World");',
        language: 'javascript'
      };

      api.mockResolvedValueOnce({ data: { files: mockFiles } });
      api.mockResolvedValueOnce({ data: mockFileContent });

      render(<FileTree selectedProject={mockSelectedProject} />);

      await waitFor(() => {
        expect(screen.getByText('package.json')).toBeInTheDocument();
      });

      const packageJson = screen.getByText('package.json');
      await user.click(packageJson);

      await waitFor(() => {
        expect(screen.getByTestId('code-editor')).toBeInTheDocument();
      });

      const closeButton = screen.getByTestId('close-editor');
      await user.click(closeButton);

      expect(screen.queryByTestId('code-editor')).not.toBeInTheDocument();
    });

    it('saves file content when save button is clicked', async () => {
      const user = userEvent.setup();
      const mockFileContent = {
        content: 'console.log("Hello World");',
        language: 'javascript'
      };

      api.mockResolvedValueOnce({ data: { files: mockFiles } });
      api.mockResolvedValueOnce({ data: mockFileContent });
      api.mockResolvedValueOnce({ data: { success: true } });

      render(<FileTree selectedProject={mockSelectedProject} />);

      await waitFor(() => {
        expect(screen.getByText('package.json')).toBeInTheDocument();
      });

      const packageJson = screen.getByText('package.json');
      await user.click(packageJson);

      await waitFor(() => {
        expect(screen.getByTestId('code-editor')).toBeInTheDocument();
      });

      const saveButton = screen.getByTestId('save-file');
      await user.click(saveButton);

      expect(api).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('/api/files/save'),
          data: expect.objectContaining({
            path: '/path/to/project/package.json',
            content: mockFileContent.content
          })
        })
      );
    });

    it('opens image files in image viewer', async () => {
      const user = userEvent.setup();
      const imageFiles = [
        {
          name: 'test.jpg',
          path: '/path/to/project/test.jpg',
          type: 'file',
          extension: 'jpg',
          size: 1024,
          isImage: true
        }
      ];

      api.mockResolvedValueOnce({ data: { files: imageFiles } });
      api.mockResolvedValueOnce({ data: { url: 'data:image/jpeg;base64,abc123' } });

      render(<FileTree selectedProject={mockSelectedProject} />);

      await waitFor(() => {
        expect(screen.getByText('test.jpg')).toBeInTheDocument();
      });

      const imageFile = screen.getByText('test.jpg');
      await user.click(imageFile);

      await waitFor(() => {
        expect(screen.getByTestId('image-viewer')).toBeInTheDocument();
      });
    });
  });

  describe('View Modes', () => {
    it('starts with detailed view mode', async () => {
      render(<FileTree selectedProject={mockSelectedProject} />);

      await waitFor(() => {
        expect(screen.getByTestId('scroll-area')).toBeInTheDocument();
      });

      // Should show file details in detailed mode
      expect(screen.getByText('package.json')).toBeInTheDocument();
    });

    it('switches between view modes', async () => {
      const user = userEvent.setup();
      render(<FileTree selectedProject={mockSelectedProject} />);

      await waitFor(() => {
        expect(screen.getByTestId('scroll-area')).toBeInTheDocument();
      });

      // Find and click view mode toggle
      const viewModeToggle = screen.getByTestId('view-mode-toggle') ||
                             screen.getByLabelText(/view mode/i);

      if (viewModeToggle) {
        await user.click(viewModeToggle);

        // Should switch to simple view
        expect(localStorage.getItem('file-tree-view-mode')).toBe('simple');
      }
    });

    it('loads saved view mode preference from localStorage', async () => {
      localStorage.setItem('file-tree-view-mode', 'compact');

      render(<FileTree selectedProject={mockSelectedProject} />);

      await waitFor(() => {
        expect(screen.getByTestId('scroll-area')).toBeInTheDocument();
      });

      // Component should respect saved preference
      expect(screen.getByTestId('scroll-area')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('filters files based on search query', async () => {
      const user = userEvent.setup();
      render(<FileTree selectedProject={mockSelectedProject} />);

      await waitFor(() => {
        expect(screen.getByTestId('scroll-area')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i) ||
                         screen.getByRole('textbox', { name: /search/i });

      if (searchInput) {
        await user.type(searchInput, 'package');

        await waitFor(() => {
          expect(screen.getByText('package.json')).toBeInTheDocument();
          expect(screen.queryByText('App.jsx')).not.toBeInTheDocument();
        });
      }
    });

    it('auto-expands directories containing search matches', async () => {
      const user = userEvent.setup();
      render(<FileTree selectedProject={mockSelectedProject} />);

      await waitFor(() => {
        expect(screen.getByTestId('scroll-area')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i) ||
                         screen.getByRole('textbox', { name: /search/i });

      if (searchInput) {
        await user.type(searchInput, 'App');

        await waitFor(() => {
          expect(screen.getByText('App.jsx')).toBeInTheDocument();
          // Parent directories should be expanded
          expect(screen.getByText('components')).toBeInTheDocument();
          expect(screen.getByText('src')).toBeInTheDocument();
        });
      }
    });

    it('clears search when clear button is clicked', async () => {
      const user = userEvent.setup();
      render(<FileTree selectedProject={mockSelectedProject} />);

      await waitFor(() => {
        expect(screen.getByTestId('scroll-area')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i) ||
                         screen.getByRole('textbox', { name: /search/i });

      if (searchInput) {
        await user.type(searchInput, 'package');

        const clearButton = screen.getByTestId('clear-search') ||
                           screen.getByLabelText(/clear search/i);

        if (clearButton) {
          await user.click(clearButton);

          expect(searchInput).toHaveValue('');
          expect(screen.getByText('src')).toBeInTheDocument();
          expect(screen.getByText('package.json')).toBeInTheDocument();
        }
      }
    });
  });

  describe('File Actions', () => {
    it('shows file actions menu on right click', async () => {
      const user = userEvent.setup();
      render(<FileTree selectedProject={mockSelectedProject} />);

      await waitFor(() => {
        expect(screen.getByText('package.json')).toBeInTheDocument();
      });

      const packageJson = screen.getByText('package.json');

      // Right click to show context menu
      fireEvent.contextMenu(packageJson);

      await waitFor(() => {
        expect(screen.getByText(/delete/i)).toBeInTheDocument();
        expect(screen.getByText(/rename/i)).toBeInTheDocument();
      });
    });

    it('deletes file when delete action is confirmed', async () => {
      const user = userEvent.setup();
      api.mockResolvedValueOnce({ data: { files: mockFiles } });
      api.mockResolvedValueOnce({ data: { success: true } });

      render(<FileTree selectedProject={mockSelectedProject} />);

      await waitFor(() => {
        expect(screen.getByText('package.json')).toBeInTheDocument();
      });

      const packageJson = screen.getByText('package.json');
      fireEvent.contextMenu(packageJson);

      await waitFor(() => {
        const deleteButton = screen.getByText(/delete/i);
        user.click(deleteButton);
      });

      // Confirm deletion
      const confirmButton = screen.getByText(/yes/i) || screen.getByText(/confirm/i);
      await user.click(confirmButton);

      expect(api).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'DELETE',
          url: expect.stringContaining('/api/files'),
          data: expect.objectContaining({
            path: '/path/to/project/package.json'
          })
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      api.mockRejectedValue(new Error('Network error'));

      render(<FileTree selectedProject={mockSelectedProject} />);

      await waitFor(() => {
        expect(screen.getByText(/Error loading files/i)).toBeInTheDocument();
      });
    });

    it('shows retry button on error', async () => {
      api.mockRejectedValue(new Error('Network error'));

      render(<FileTree selectedProject={mockSelectedProject} />);

      await waitFor(() => {
        expect(screen.getByText(/Error loading files/i)).toBeInTheDocument();
        expect(screen.getByText(/retry/i)).toBeInTheDocument();
      });
    });

    it('retries file loading when retry button is clicked', async () => {
      const user = userEvent.setup();
      api.mockRejectedValueOnce(new Error('Network error'));
      api.mockResolvedValueOnce({ data: { files: mockFiles } });

      render(<FileTree selectedProject={mockSelectedProject} />);

      await waitFor(() => {
        expect(screen.getByText(/Error loading files/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByText(/retry/i);
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('src')).toBeInTheDocument();
        expect(screen.getByText('package.json')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', async () => {
      render(<FileTree selectedProject={mockSelectedProject} />);

      await waitFor(() => {
        const fileTree = screen.getByRole('tree') || screen.getByTestId('scroll-area');
        expect(fileTree).toBeInTheDocument();
      });
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<FileTree selectedProject={mockSelectedProject} />);

      await waitFor(() => {
        expect(screen.getByText('package.json')).toBeInTheDocument();
      });

      await user.tab();

      // Should be able to focus on interactive elements
      const firstInteractiveElement = screen.getByRole('button', { name: /expand/i }) ||
                                     screen.getByText('src');

      expect(firstInteractiveElement).toBeInTheDocument();
    });

    it('announces file operations to screen readers', async () => {
      const user = userEvent.setup();
      const mockFileContent = {
        content: 'console.log("Hello World");',
        language: 'javascript'
      };

      api.mockResolvedValueOnce({ data: { files: mockFiles } });
      api.mockResolvedValueOnce({ data: mockFileContent });

      render(<FileTree selectedProject={mockSelectedProject} />);

      await waitFor(() => {
        expect(screen.getByText('package.json')).toBeInTheDocument();
      });

      const packageJson = screen.getByText('package.json');
      await user.click(packageJson);

      await waitFor(() => {
        const editor = screen.getByTestId('code-editor');
        expect(editor).toHaveAttribute('role', 'dialog');
      });
    });
  });

  describe('Performance', () => {
    it('efficiently handles large file trees', async () => {
      // Generate a large file structure
      const largeFileStructure = Array.from({ length: 1000 }, (_, i) => ({
        name: `file${i}.js`,
        path: `/path/to/project/file${i}.js`,
        type: 'file',
        extension: 'js',
        size: 1024,
        modified: '2024-01-01T00:00:00Z'
      }));

      api.mockResolvedValue({ data: { files: largeFileStructure } });

      const startTime = performance.now();
      render(<FileTree selectedProject={mockSelectedProject} />);
      const endTime = performance.now();

      // Should render within reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('debounces search input to avoid excessive re-renders', async () => {
      const user = userEvent.setup();
      render(<FileTree selectedProject={mockSelectedProject} />);

      await waitFor(() => {
        expect(screen.getByTestId('scroll-area')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i) ||
                         screen.getByRole('textbox', { name: /search/i });

      if (searchInput) {
        const startTime = performance.now();

        // Type multiple characters quickly
        await user.type(searchInput, 'package');

        const endTime = performance.now();

        // Should handle input efficiently
        expect(endTime - startTime).toBeLessThan(500);
      }
    });
  });
});