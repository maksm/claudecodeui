import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Sidebar from '../../../src/components/Sidebar.jsx';
import { api } from '../../../src/utils/api';
import { useTaskMaster } from '../../../src/contexts/TaskMasterContext';
import { useTasksSettings } from '../../../src/contexts/TasksSettingsContext';

// Mock dependencies
jest.mock('../../../src/utils/api');

jest.mock('../../../src/contexts/TaskMasterContext');
jest.mock('../../../src/contexts/TasksSettingsContext');

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

jest.mock('../../../src/components/ClaudeLogo', () => ({
  default: ({ className }) => <div data-testid="claude-logo" className={className} />
}));

jest.mock('../../../src/components/CursorLogo', () => ({
  default: ({ className }) => <div data-testid="cursor-logo" className={className} />
}));

jest.mock('../../../src/components/TaskIndicator', () => ({
  default: ({ session }) => (
    <div data-testid="task-indicator">
      <span data-testid="session-id">{session?.id}</span>
      <span data-testid="session-status">{session?.status}</span>
    </div>
  )
}));

jest.mock('../../../src/components/ProjectCreationWizard', () => ({
  default: ({ isOpen, onClose, onComplete }) => (
    <div data-testid="project-creation-wizard">
      <button onClick={() => onComplete({ id: 'new-project', name: 'New Project' })}>
        Create Project
      </button>
      <button onClick={onClose}>Cancel</button>
    </div>
  )
}));

describe('Sidebar Component', () => {
  const mockProjects = [
    {
      id: 'project-1',
      name: 'Project One',
      path: '/path/to/project1',
      lastModified: '2024-01-01T00:00:00Z',
      sessions: [
        {
          id: 'session-1',
          title: 'Session One',
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' }
          ],
          lastModified: '2024-01-01T12:00:00Z',
          status: 'active'
        }
      ]
    },
    {
      id: 'project-2',
      name: 'Project Two',
      path: '/path/to/project2',
      lastModified: '2024-01-02T00:00:00Z',
      sessions: []
    }
  ];

  const defaultProps = {
    projects: mockProjects,
    selectedProject: mockProjects[0],
    selectedSession: mockProjects[0].sessions[0],
    onProjectSelect: jest.fn(),
    onSessionSelect: jest.fn(),
    onNewSession: jest.fn(),
    isActive: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock Task Master context
    useTaskMaster.mockReturnValue({
      tasks: [],
      nextTask: null,
      loading: false
    });

    // Mock Tasks Settings context
    useTasksSettings.mockReturnValue({
      tasksEnabled: true,
      isTaskMasterReady: true
    });

    // Mock API responses
    api.mockResolvedValue({ data: { success: true } });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('renders sidebar with projects and sessions', () => {
      render(<Sidebar {...defaultProps} />);

      expect(screen.getByTestId('scroll-area')).toBeInTheDocument();
      expect(screen.getByText('Project One')).toBeInTheDocument();
      expect(screen.getByText('Project Two')).toBeInTheDocument();
      expect(screen.getByText('Session One')).toBeInTheDocument();
    });

    it('highlights selected project', () => {
      render(<Sidebar {...defaultProps} />);

      const selectedProject = screen.getByText('Project One');
      expect(selectedProject).toHaveClass('selected');
    });

    it('highlights selected session', () => {
      render(<Sidebar {...defaultProps} />);

      const selectedSession = screen.getByText('Session One');
      expect(selectedSession).toHaveClass('selected');
    });

    it('shows empty state when no projects', () => {
      render(<Sidebar {...defaultProps} projects={[]} />);

      expect(screen.getByText(/No projects found/i)).toBeInTheDocument();
      expect(screen.getByText(/Create your first project/i)).toBeInTheDocument();
    });
  });

  describe('Project Management', () => {
    it('opens project creation wizard when new project button is clicked', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      const newProjectButton = screen.getByRole('button', { name: /new project/i });
      await user.click(newProjectButton);

      expect(screen.getByTestId('project-creation-wizard')).toBeInTheDocument();
    });

    it('calls onProjectSelect when project is clicked', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      const projectTwo = screen.getByText('Project Two');
      await user.click(projectTwo);

      expect(defaultProps.onProjectSelect).toHaveBeenCalledWith(mockProjects[1]);
    });

    it('expands project to show sessions', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      const expandButton = screen.getByTestId('expand-project-1') ||
                         screen.getByRole('button', { name: /expand/i });

      if (expandButton) {
        await user.click(expandButton);

        expect(screen.getByText('Session One')).toBeInTheDocument();
      }
    });

    it('collapses project when clicked while expanded', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      // First expand to see sessions
      const expandButton = screen.getByTestId('expand-project-1') ||
                         screen.getByRole('button', { name: /expand/i });

      if (expandButton) {
        await user.click(expandButton);

        // Then collapse
        await user.click(expandButton);

        // Sessions should not be visible when collapsed
        expect(screen.queryByText('Session One')).not.toBeInTheDocument();
      }
    });

    it('deletes project when delete button is clicked', async () => {
      const user = userEvent.setup();
      api.mockResolvedValue({ data: { success: true } });

      render(<Sidebar {...defaultProps} />);

      const deleteButton = screen.getByTestId('delete-project-2') ||
                          screen.getByRole('button', { name: /delete project two/i });

      if (deleteButton) {
        await user.click(deleteButton);

        // Confirm deletion
        const confirmButton = screen.getByText(/delete/i);
        await user.click(confirmButton);

        expect(api).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'DELETE',
            url: '/api/projects/project-2'
          })
        );
      }
    });
  });

  describe('Session Management', () => {
    it('calls onSessionSelect when session is clicked', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      const sessionOne = screen.getByText('Session One');
      await user.click(sessionOne);

      expect(defaultProps.onSessionSelect).toHaveBeenCalledWith(mockProjects[0].sessions[0]);
    });

    it('calls onNewSession when new session button is clicked', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      const newSessionButton = screen.getByRole('button', { name: /new session/i });
      await user.click(newSessionButton);

      expect(defaultProps.onNewSession).toHaveBeenCalledWith(mockProjects[0]);
    });

    it('deletes session when delete button is clicked', async () => {
      const user = userEvent.setup();
      api.mockResolvedValue({ data: { success: true } });

      render(<Sidebar {...defaultProps} />);

      const deleteSessionButton = screen.getByTestId('delete-session-1') ||
                                 screen.getByRole('button', { name: /delete session/i });

      if (deleteSessionButton) {
        await user.click(deleteSessionButton);

        // Confirm deletion
        const confirmButton = screen.getByText(/delete/i);
        await user.click(confirmButton);

        expect(api).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'DELETE',
            url: '/api/sessions/session-1'
          })
        );
      }
    });

    it('shows session time ago correctly', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const projectWithRecentSession = {
        ...mockProjects[0],
        sessions: [
          {
            ...mockProjects[0].sessions[0],
            lastModified: oneHourAgo.toISOString()
          }
        ]
      };

      render(<Sidebar
        {...defaultProps}
        projects={[projectWithRecentSession]}
      />);

      // Time ago should be displayed
      expect(screen.getByText(/hours? ago/i)).toBeInTheDocument();
    });
  });

  describe('Task Master Integration', () => {
    it('shows next task banner when Task Master is enabled', () => {
      useTaskMaster.mockReturnValue({
        tasks: [],
        nextTask: { id: 1, title: 'Next Task', priority: 'high' },
        loading: false
      });

      render(<Sidebar {...defaultProps} />);

      expect(screen.getByTestId('next-task-banner')).toBeInTheDocument();
      expect(screen.getByText('Next Task')).toBeInTheDocument();
    });

    it('hides Task Master section when disabled', () => {
      useTasksSettings.mockReturnValue({
        tasksEnabled: false,
        isTaskMasterReady: false
      });

      render(<Sidebar {...defaultProps} />);

      expect(screen.queryByTestId('next-task-banner')).not.toBeInTheDocument();
    });

    it('shows loading state when Task Master is loading', () => {
      useTaskMaster.mockReturnValue({
        tasks: [],
        nextTask: null,
        loading: true
      });

      render(<Sidebar {...defaultProps} />);

      expect(screen.getByText(/loading tasks/i)).toBeInTheDocument();
    });

    it('shows empty state when no tasks are available', () => {
      useTaskMaster.mockReturnValue({
        tasks: [],
        nextTask: null,
        loading: false
      });

      render(<Sidebar {...defaultProps} />);

      expect(screen.getByText(/no tasks available/i)).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('filters projects based on search query', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search projects/i) ||
                         screen.getByRole('textbox', { name: /search/i });

      if (searchInput) {
        await user.type(searchInput, 'Two');

        await waitFor(() => {
          expect(screen.getByText('Project Two')).toBeInTheDocument();
          expect(screen.queryByText('Project One')).not.toBeInTheDocument();
        });
      }
    });

    it('filters sessions based on search query', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search projects/i) ||
                         screen.getByRole('textbox', { name: /search/i });

      if (searchInput) {
        await user.type(searchInput, 'Session');

        await waitFor(() => {
          expect(screen.getByText('Session One')).toBeInTheDocument();
        });
      }
    });

    it('clears search when clear button is clicked', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search projects/i) ||
                         screen.getByRole('textbox', { name: /search/i });

      if (searchInput) {
        await user.type(searchInput, 'test');

        const clearButton = screen.getByTestId('clear-search') ||
                           screen.getByRole('button', { name: /clear search/i });

        if (clearButton) {
          await user.click(clearButton);

          expect(searchInput).toHaveValue('');
          expect(screen.getByText('Project One')).toBeInTheDocument();
          expect(screen.getByText('Project Two')).toBeInTheDocument();
        }
      }
    });
  });

  describe('Project Refresh', () => {
    it('refreshes projects when refresh button is clicked', async () => {
      const user = userEvent.setup();
      api.mockResolvedValue({ data: { projects: mockProjects } });

      render(<Sidebar {...defaultProps} />);

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await user.click(refreshButton);

      expect(api).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/api/projects'
        })
      );
    });

    it('shows loading state during refresh', async () => {
      const user = userEvent.setup();
      api.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(<Sidebar {...defaultProps} />);

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await user.click(refreshButton);

      expect(screen.getByText(/refreshing/i)).toBeInTheDocument();
      expect(refreshButton).toBeDisabled();
    });
  });

  describe('Project Creation Wizard', () => {
    it('opens wizard when new project button is clicked', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      const newProjectButton = screen.getByRole('button', { name: /new project/i });
      await user.click(newProjectButton);

      expect(screen.getByTestId('project-creation-wizard')).toBeInTheDocument();
    });

    it('closes wizard when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      const newProjectButton = screen.getByRole('button', { name: /new project/i });
      await user.click(newProjectButton);

      const cancelButton = screen.getByTestId('project-creation-wizard').querySelector('button');
      await user.click(cancelButton);

      expect(screen.queryByTestId('project-creation-wizard')).not.toBeInTheDocument();
    });

    it('handles successful project creation', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      const newProjectButton = screen.getByRole('button', { name: /new project/i });
      await user.click(newProjectButton);

      const createButton = screen.getByText('Create Project');
      await user.click(createButton);

      expect(screen.queryByTestId('project-creation-wizard')).not.toBeInTheDocument();
    });
  });

  describe('Session Protection', () => {
    it('pauses updates when session is active', () => {
      render(<Sidebar
        {...defaultProps}
        selectedSession={{ id: 'active-session', status: 'active' }}
      />);

      expect(screen.getByText(/Session in progress/i)).toBeInTheDocument();
    });

    it('shows session protection status', () => {
      render(<Sidebar
        {...defaultProps}
        selectedSession={{ id: 'active-session', status: 'active' }}
      />);

      expect(screen.getByTestId('task-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('session-id')).toHaveTextContent('active-session');
      expect(screen.getByTestId('session-status')).toHaveTextContent('active');
    });

    it('resumes updates when session ends', async () => {
      const { rerender } = render(<Sidebar
        {...defaultProps}
        selectedSession={{ id: 'active-session', status: 'active' }}
      />);

      expect(screen.getByText(/Session in progress/i)).toBeInTheDocument();

      rerender(<Sidebar
        {...defaultProps}
        selectedSession={null}
      />);

      expect(screen.queryByText(/Session in progress/i)).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      const user = userEvent.setup();
      api.mockRejectedValue(new Error('API Error'));

      render(<Sidebar {...defaultProps} />);

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await user.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByText(/Error loading projects/i)).toBeInTheDocument();
      });
    });

    it('shows retry button on error', async () => {
      const user = userEvent.setup();
      api.mockRejectedValue(new Error('Network error'));

      render(<Sidebar {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/retry/i)).toBeInTheDocument();
      });
    });

    it('retries operation when retry button is clicked', async () => {
      const user = userEvent.setup();
      api.mockRejectedValueOnce(new Error('Network error'));
      api.mockResolvedValueOnce({ data: { projects: mockProjects } });

      render(<Sidebar {...defaultProps} />);

      await waitFor(() => {
        const retryButton = screen.getByText(/retry/i);
        user.click(retryButton);
      });

      await waitFor(() => {
        expect(api).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<Sidebar {...defaultProps} />);

      const sidebar = screen.getByRole('complementary') || screen.getByTestId('sidebar');
      expect(sidebar).toHaveAttribute('aria-label', 'Project and session sidebar');
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.tab();
      const firstTabbable = screen.getByRole('button', { name: /new project/i });
      expect(firstTabbable).toHaveFocus();
    });

    it('announces actions to screen readers', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      const projectOne = screen.getByText('Project One');
      await user.click(projectOne);

      expect(screen.getByRole('status')).toHaveTextContent(/Project One selected/i);
    });
  });

  describe('Performance', () => {
    it('debounces search input', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search projects/i) ||
                         screen.getByRole('textbox', { name: /search/i });

      if (searchInput) {
        const startTime = performance.now();

        // Type multiple characters quickly
        await user.type(searchInput, 'Project One');

        const endTime = performance.now();

        // Should handle input efficiently
        expect(endTime - startTime).toBeLessThan(500);
      }
    });

    it('efficiently handles large project lists', async () => {
      // Generate large project list
      const largeProjectList = Array.from({ length: 1000 }, (_, i) => ({
        id: `project-${i}`,
        name: `Project ${i}`,
        path: `/path/to/project-${i}`,
        lastModified: new Date().toISOString(),
        sessions: []
      }));

      const startTime = performance.now();
      render(<Sidebar
        {...defaultProps}
        projects={largeProjectList}
      />);
      const endTime = performance.now();

      // Should render within reasonable time
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe('Responsive Behavior', () => {
    it('adapts to mobile view', () => {
      // Mock mobile viewport
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      render(<Sidebar {...defaultProps} />);

      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toHaveClass('mobile');
    });

    it('collapses on mobile when not active', () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      render(<Sidebar
        {...defaultProps}
        isActive={false}
      />);

      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toHaveClass('collapsed');
    });
  });
});