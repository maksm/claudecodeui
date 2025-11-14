import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Settings from '../../../src/components/Settings.jsx';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { useTasksSettings } from '../../../src/contexts/TasksSettingsContext';
import { api } from '../../../src/utils/api';

// Mock dependencies
jest.mock('../../../src/contexts/ThemeContext');
jest.mock('../../../src/contexts/TasksSettingsContext');
jest.mock('../../../src/utils/api');

jest.mock('../../../src/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }) => <div data-testid="scroll-area">{children}</div>,
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
  ),
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
  ),
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
  ),
}));

jest.mock('../../../src/components/StandaloneShell', () => ({
  default: ({ command, onComplete }) => (
    <div data-testid="standalone-shell">
      <div data-testid="command">{command}</div>
      <button onClick={() => onComplete('done')}>Complete</button>
    </div>
  ),
}));

jest.mock('../../../src/components/ClaudeLogo', () => ({
  default: ({ className }) => <div data-testid="claude-logo" className={className} />,
}));

jest.mock('../../../src/components/CursorLogo', () => ({
  default: ({ className }) => <div data-testid="cursor-logo" className={className} />,
}));

jest.mock('../../../src/components/CredentialsSettings', () => ({
  default: ({ onClose }) => (
    <div data-testid="credentials-settings">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

describe('Settings Component', () => {
  const mockToggleDarkMode = jest.fn();
  const mockSetTasksEnabled = jest.fn();
  const mockOnClose = jest.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    projects: [
      { id: '1', name: 'Project 1', path: '/path/to/project1' },
      { id: '2', name: 'Project 2', path: '/path/to/project2' },
    ],
    initialTab: 'tools',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    // Mock theme context
    useTheme.mockReturnValue({
      isDarkMode: false,
      toggleDarkMode: mockToggleDarkMode,
    });

    // Mock tasks settings context
    useTasksSettings.mockReturnValue({
      tasksEnabled: true,
      setTasksEnabled: mockSetTasksEnabled,
      isTaskMasterInstalled: true,
      isTaskMasterReady: true,
      installationStatus: 'installed',
      isCheckingInstallation: false,
    });

    // Mock API responses
    api.mockResolvedValue({
      data: {
        allowedTools: ['Edit', 'Read'],
        disallowedTools: ['Bash', 'Write'],
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  describe('Basic Rendering', () => {
    it('renders settings modal when open', () => {
      render(<Settings {...defaultProps} />);

      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByTestId('scroll-area')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(<Settings {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });

    it('shows all main tabs', () => {
      render(<Settings {...defaultProps} />);

      expect(screen.getByText('Tools')).toBeInTheDocument();
      expect(screen.getByText('Projects')).toBeInTheDocument();
      expect(screen.getByText('Security')).toBeInTheDocument();
      expect(screen.getByText('Theme')).toBeInTheDocument();
      expect(screen.getByText('Task Master')).toBeInTheDocument();
      expect(screen.getByText('MCP Servers')).toBeInTheDocument();
    });

    it('starts with specified initial tab', () => {
      render(<Settings {...defaultProps} initialTab="theme" />);

      expect(screen.getByText('Dark Mode')).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('switches between tabs when clicked', async () => {
      const user = userEvent.setup();
      render(<Settings {...defaultProps} />);

      const themeTab = screen.getByText('Theme');
      await user.click(themeTab);

      expect(screen.getByText('Dark Mode')).toBeInTheDocument();

      const toolsTab = screen.getByText('Tools');
      await user.click(toolsTab);

      expect(screen.getByText('Allowed Tools')).toBeInTheDocument();
    });

    it('highlights active tab', () => {
      render(<Settings {...defaultProps} />);

      const toolsTab = screen.getByText('Tools');
      expect(toolsTab).toHaveClass('active');
    });
  });

  describe('Theme Settings', () => {
    it('displays current theme state', () => {
      useTheme.mockReturnValue({
        isDarkMode: true,
        toggleDarkMode: mockToggleDarkMode,
      });

      render(<Settings {...defaultProps} />);

      expect(screen.getByText('Dark Mode')).toBeInTheDocument();
      expect(screen.getByText('Light Mode')).toBeInTheDocument();
    });

    it('toggles dark mode when switch is clicked', async () => {
      const user = userEvent.setup();
      render(<Settings {...defaultProps} />);

      const darkModeToggle = screen.getByRole('switch', { name: /dark mode/i });
      await user.click(darkModeToggle);

      expect(mockToggleDarkMode).toHaveBeenCalled();
    });

    it('shows theme preview', () => {
      render(<Settings {...defaultProps} />);

      expect(screen.getByText('Theme Preview')).toBeInTheDocument();
    });
  });

  describe('Tools Settings', () => {
    beforeEach(() => {
      useTasksSettings.mockReturnValue({
        ...useTasksSettings(),
        tasksEnabled: true,
      });
    });

    it('displays allowed and disallowed tools', async () => {
      render(<Settings {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Allowed Tools')).toBeInTheDocument();
        expect(screen.getByText('Disallowed Tools')).toBeInTheDocument();
      });
    });

    it('allows adding new allowed tools', async () => {
      const user = userEvent.setup();
      api.mockResolvedValue({ data: { success: true } });

      render(<Settings {...defaultProps} />);

      const newToolInput = screen.getByPlaceholderText(/Add allowed tool/i);
      const addButton = screen.getByText('Add to Allowed');

      await user.type(newToolInput, 'NewTool');
      await user.click(addButton);

      expect(api).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/api/settings/allowed-tools',
          data: { tool: 'NewTool' },
        })
      );
    });

    it('allows adding new disallowed tools', async () => {
      const user = userEvent.setup();
      api.mockResolvedValue({ data: { success: true } });

      render(<Settings {...defaultProps} />);

      const newToolInput = screen.getByPlaceholderText(/Add disallowed tool/i);
      const addButton = screen.getByText('Add to Disallowed');

      await user.type(newToolInput, 'DangerousTool');
      await user.click(addButton);

      expect(api).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/api/settings/disallowed-tools',
          data: { tool: 'DangerousTool' },
        })
      );
    });

    it('removes tools from allowed list', async () => {
      const user = userEvent.setup();
      api.mockResolvedValue({ data: { success: true } });

      render(<Settings {...defaultProps} />);

      await waitFor(() => {
        const removeButton = screen.getByTestId('remove-allowed-Edit');
        user.click(removeButton);
      });

      expect(api).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'DELETE',
          url: '/api/settings/allowed-tools/Edit',
        })
      );
    });

    it('enables skip permissions option', async () => {
      const user = userEvent.setup();
      api.mockResolvedValue({ data: { success: true } });

      render(<Settings {...defaultProps} />);

      const skipPermissions = screen.getByRole('checkbox', { name: /skip permissions/i });
      await user.click(skipPermissions);

      expect(api).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/api/settings/skip-permissions',
          data: { enabled: true },
        })
      );
    });
  });

  describe('Project Settings', () => {
    it('displays project list', () => {
      render(<Settings {...defaultProps} />);

      expect(screen.getByText('Project 1')).toBeInTheDocument();
      expect(screen.getByText('Project 2')).toBeInTheDocument();
    });

    it('sets project sort order', async () => {
      const user = userEvent.setup();
      api.mockResolvedValue({ data: { success: true } });

      render(<Settings {...defaultProps} />);

      const sortOrderSelect = screen.getByRole('combobox', { name: /sort order/i });
      await user.selectOptions(sortOrderSelect, 'modified');

      expect(api).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/api/settings/project-sort-order',
          data: { sortOrder: 'modified' },
        })
      );
    });
  });

  describe('Task Master Settings', () => {
    it('displays Task Master installation status', () => {
      useTasksSettings.mockReturnValue({
        tasksEnabled: true,
        setTasksEnabled: mockSetTasksEnabled,
        isTaskMasterInstalled: true,
        isTaskMasterReady: true,
        installationStatus: 'installed',
        isCheckingInstallation: false,
      });

      render(<Settings {...defaultProps} />);

      expect(screen.getByText('Task Master Status')).toBeInTheDocument();
      expect(screen.getByText('Installed')).toBeInTheDocument();
    });

    it('shows installation button when not installed', () => {
      useTasksSettings.mockReturnValue({
        tasksEnabled: false,
        setTasksEnabled: mockSetTasksEnabled,
        isTaskMasterInstalled: false,
        isTaskMasterReady: false,
        installationStatus: 'not_installed',
        isCheckingInstallation: false,
      });

      render(<Settings {...defaultProps} />);

      expect(screen.getByText('Install Task Master')).toBeInTheDocument();
    });

    it('toggles Task Master enabled state', async () => {
      const user = userEvent.setup();

      useTasksSettings.mockReturnValue({
        tasksEnabled: true,
        setTasksEnabled: mockSetTasksEnabled,
        isTaskMasterInstalled: true,
        isTaskMasterReady: true,
        installationStatus: 'installed',
        isCheckingInstallation: false,
      });

      render(<Settings {...defaultProps} />);

      const enableToggle = screen.getByRole('switch', { name: /enable task master/i });
      await user.click(enableToggle);

      expect(mockSetTasksEnabled).toHaveBeenCalledWith(false);
    });

    it('shows loading state during installation check', () => {
      useTasksSettings.mockReturnValue({
        tasksEnabled: false,
        setTasksEnabled: mockSetTasksEnabled,
        isTaskMasterInstalled: false,
        isTaskMasterReady: false,
        installationStatus: 'unknown',
        isCheckingInstallation: true,
      });

      render(<Settings {...defaultProps} />);

      expect(screen.getByText('Checking installation...')).toBeInTheDocument();
    });
  });

  describe('Security Settings', () => {
    it('shows credentials settings section', () => {
      render(<Settings {...defaultProps} />);

      expect(screen.getByText('API Keys & Credentials')).toBeInTheDocument();
    });

    it('opens credentials settings modal', async () => {
      const user = userEvent.setup();
      render(<Settings {...defaultProps} />);

      const manageButton = screen.getByText('Manage Credentials');
      await user.click(manageButton);

      expect(screen.getByTestId('credentials-settings')).toBeInTheDocument();
    });

    it('closes credentials settings when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<Settings {...defaultProps} />);

      const manageButton = screen.getByText('Manage Credentials');
      await user.click(manageButton);

      const closeButton = screen.getByTestId('credentials-settings').querySelector('button');
      await user.click(closeButton);

      expect(screen.queryByTestId('credentials-settings')).not.toBeInTheDocument();
    });
  });

  describe('MCP Servers Settings', () => {
    it('shows MCP servers list', () => {
      render(<Settings {...defaultProps} />);

      expect(screen.getByText('MCP Servers')).toBeInTheDocument();
    });

    it('opens add MCP server form', async () => {
      const user = userEvent.setup();
      render(<Settings {...defaultProps} />);

      const addButton = screen.getByText('Add Server');
      await user.click(addButton);

      expect(screen.getByText('Server Configuration')).toBeInTheDocument();
    });

    it('fills MCP server form fields', async () => {
      const user = userEvent.setup();
      render(<Settings {...defaultProps} />);

      const addButton = screen.getByText('Add Server');
      await user.click(addButton);

      const nameInput = screen.getByRole('textbox', { name: /server name/i });
      await user.type(nameInput, 'Test Server');

      expect(nameInput).toHaveValue('Test Server');
    });
  });

  describe('Modal Behavior', () => {
    it('closes when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<Settings {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: /close settings/i });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes when Escape key is pressed', async () => {
      const user = userEvent.setup();
      render(<Settings {...defaultProps} />);

      await user.keyboard('{Escape}');

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes when backdrop is clicked', async () => {
      const user = userEvent.setup();
      render(<Settings {...defaultProps} />);

      const backdrop =
        screen.getByTestId('settings-backdrop') || screen.getByRole('dialog').parentElement;
      await user.click(backdrop);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Form Validation', () => {
    it('validates tool names before adding', async () => {
      const user = userEvent.setup();
      render(<Settings {...defaultProps} />);

      const newToolInput = screen.getByPlaceholderText(/Add allowed tool/i);
      const addButton = screen.getByText('Add to Allowed');

      // Try adding empty tool name
      await user.click(addButton);

      expect(screen.getByText(/Tool name is required/i)).toBeInTheDocument();
      expect(api).not.toHaveBeenCalled();
    });

    it('validates MCP server configuration', async () => {
      const user = userEvent.setup();
      render(<Settings {...defaultProps} />);

      const addButton = screen.getByText('Add Server');
      await user.click(addButton);

      const saveButton = screen.getByText('Save Server');
      await user.click(saveButton);

      expect(screen.getByText(/Server name is required/i)).toBeInTheDocument();
      expect(api).not.toHaveBeenCalled();
    });

    it('handles invalid JSON in MCP configuration', async () => {
      const user = userEvent.setup();
      render(<Settings {...defaultProps} />);

      const addButton = screen.getByText('Add Server');
      await user.click(addButton);

      const jsonModeToggle = screen.getByText('Import JSON');
      await user.click(jsonModeToggle);

      const jsonInput = screen.getByRole('textbox', { name: /json configuration/i });
      await user.type(jsonInput, '{ invalid json }');

      const saveButton = screen.getByText('Save Server');
      await user.click(saveButton);

      expect(screen.getByText(/Invalid JSON format/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('displays error messages when API calls fail', async () => {
      const user = userEvent.setup();
      api.mockRejectedValue(new Error('API Error'));

      render(<Settings {...defaultProps} />);

      const newToolInput = screen.getByPlaceholderText(/Add allowed tool/i);
      const addButton = screen.getByText('Add to Allowed');

      await user.type(newToolInput, 'NewTool');
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed to add tool/i)).toBeInTheDocument();
      });
    });

    it('handles network errors gracefully', async () => {
      const user = userEvent.setup();
      api.mockRejectedValue(new Error('Network error'));

      render(<Settings {...defaultProps} />);

      // Trigger some action that would call API
      const skipPermissions = screen.getByRole('checkbox', { name: /skip permissions/i });
      await user.click(skipPermissions);

      await waitFor(() => {
        expect(screen.getByText(/Network error occurred/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('shows loading state during save operations', async () => {
      const user = userEvent.setup();
      api.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(<Settings {...defaultProps} />);

      const skipPermissions = screen.getByRole('checkbox', { name: /skip permissions/i });
      await user.click(skipPermissions);

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('disables buttons during save operations', async () => {
      const user = userEvent.setup();
      api.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(<Settings {...defaultProps} />);

      const skipPermissions = screen.getByRole('checkbox', { name: /skip permissions/i });
      await user.click(skipPermissions);

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<Settings {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-label', 'Settings');
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<Settings {...defaultProps} />);

      await user.tab();
      const firstTabbable = screen.getByRole('tab');
      expect(firstTabbable).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /close settings/i })).toHaveFocus();
    });

    it('announces form errors to screen readers', async () => {
      const user = userEvent.setup();
      render(<Settings {...defaultProps} />);

      const newToolInput = screen.getByPlaceholderText(/Add allowed tool/i);
      const addButton = screen.getByText('Add to Allowed');

      await user.click(addButton);

      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveTextContent(/Tool name is required/i);
    });
  });

  describe('Data Persistence', () => {
    it('loads settings from API on mount', async () => {
      render(<Settings {...defaultProps} />);

      await waitFor(() => {
        expect(api).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'GET',
            url: '/api/settings',
          })
        );
      });
    });

    it('saves settings when changed', async () => {
      const user = userEvent.setup();
      api.mockResolvedValue({ data: { success: true } });

      render(<Settings {...defaultProps} />);

      const skipPermissions = screen.getByRole('checkbox', { name: /skip permissions/i });
      await user.click(skipPermissions);

      expect(api).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/api/settings/skip-permissions',
        })
      );
    });
  });
});
