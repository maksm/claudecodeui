import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AuthProvider, useAuth } from '../../../src/contexts/AuthContext.jsx';
import { api } from '../../../src/utils/api';

// Mock the API module
jest.mock('../../../src/utils/api');

// Test component to use the auth context
const TestComponent = () => {
  const { user, token, login, register, logout, isLoading, needsSetup, error } = useAuth();

  return (
    <div data-testid="auth-test">
      <div data-testid="user">{user ? user.username : 'null'}</div>
      <div data-testid="token">{token || 'null'}</div>
      <div data-testid="loading">{isLoading.toString()}</div>
      <div data-testid="needs-setup">{needsSetup.toString()}</div>
      <div data-testid="error">{error || 'null'}</div>

      <button onClick={() => login('testuser', 'testpass')}>Login</button>
      <button onClick={() => register('newuser', 'newpass')}>Register</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

const renderWithAuthProvider = () => {
  return render(
    <AuthProvider>
      <TestComponent />
    </AuthProvider>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    // Mock environment variables
    delete import.meta.env.VITE_IS_PLATFORM;
  });

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  describe('Platform Mode', () => {
    beforeEach(() => {
      import.meta.env.VITE_IS_PLATFORM = 'true';
    });

    it('initializes with dummy user in platform mode', async () => {
      renderWithAuthProvider();

      expect(screen.getByTestId('user')).toHaveTextContent('platform-user');
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('needs-setup')).toHaveTextContent('false');
    });

    it('bypasses API calls in platform mode', async () => {
      renderWithAuthProvider();

      // Should not make any API calls
      expect(api.auth.status).not.toHaveBeenCalled();
    });
  });

  describe('OSS Mode - Initial State', () => {
    it('initializes with loading state true', async () => {
      renderWithAuthProvider();

      expect(screen.getByTestId('loading')).toHaveTextContent('true');
    });

    it('checks auth status on mount', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ needsSetup: false }),
      };
      api.auth.status = jest.fn().mockResolvedValue(mockResponse);

      renderWithAuthProvider();

      expect(api.auth.status).toHaveBeenCalled();
    });

    it('handles system setup requirement', async () => {
      const mockStatusResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ needsSetup: true }),
      };
      api.auth.status = jest.fn().mockResolvedValue(mockStatusResponse);

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('needs-setup')).toHaveTextContent('true');
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
    });

    it('verifies existing token on mount', async () => {
      localStorage.setItem('auth-token', 'test-token');

      const mockStatusResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ needsSetup: false }),
      };
      const mockUserResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ user: { username: 'testuser' } }),
      };
      api.auth.status = jest.fn().mockResolvedValue(mockStatusResponse);
      api.auth.user = jest.fn().mockResolvedValue(mockUserResponse);

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('testuser');
        expect(screen.getByTestId('token')).toHaveTextContent('test-token');
      });
    });

    it('clears invalid token', async () => {
      localStorage.setItem('auth-token', 'invalid-token');

      const mockStatusResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ needsSetup: false }),
      };
      const mockUserResponse = {
        ok: false,
        status: 401,
      };
      api.auth.status = jest.fn().mockResolvedValue(mockStatusResponse);
      api.auth.user = jest.fn().mockResolvedValue(mockUserResponse);

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('null');
        expect(screen.getByTestId('token')).toHaveTextContent('null');
        expect(localStorage.getItem('auth-token')).toBeNull();
      });
    });

    it('handles API errors gracefully', async () => {
      api.auth.status = jest.fn().mockRejectedValue(new Error('Network error'));

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          'Failed to check authentication status'
        );
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
    });
  });

  describe('Login Functionality', () => {
    it('successful login sets user and token', async () => {
      const user = userEvent.setup();

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          token: 'new-token',
          user: { username: 'testuser' },
        }),
      };
      api.auth.login = jest.fn().mockResolvedValue(mockResponse);

      renderWithAuthProvider();

      await user.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('testuser');
        expect(screen.getByTestId('token')).toHaveTextContent('new-token');
        expect(localStorage.getItem('auth-token')).toBe('new-token');
      });
    });

    it('failed login sets error state', async () => {
      const user = userEvent.setup();

      const mockResponse = {
        ok: false,
        json: jest.fn().mockResolvedValue({ error: 'Invalid credentials' }),
      };
      api.auth.login = jest.fn().mockResolvedValue(mockResponse);

      renderWithAuthProvider();

      await user.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Invalid credentials');
        expect(screen.getByTestId('user')).toHaveTextContent('null');
      });
    });

    it('handles network errors during login', async () => {
      const user = userEvent.setup();

      api.auth.login = jest.fn().mockRejectedValue(new Error('Network error'));

      renderWithAuthProvider();

      await user.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Network error. Please try again.');
      });
    });
  });

  describe('Register Functionality', () => {
    it('successful registration sets user and token', async () => {
      const user = userEvent.setup();

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          token: 'register-token',
          user: { username: 'newuser' },
        }),
      };
      api.auth.register = jest.fn().mockResolvedValue(mockResponse);

      renderWithAuthProvider();

      await user.click(screen.getByText('Register'));

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('newuser');
        expect(screen.getByTestId('token')).toHaveTextContent('register-token');
        expect(screen.getByTestId('needs-setup')).toHaveTextContent('false');
      });
    });

    it('failed registration sets error state', async () => {
      const user = userEvent.setup();

      const mockResponse = {
        ok: false,
        json: jest.fn().mockResolvedValue({ error: 'Username already exists' }),
      };
      api.auth.register = jest.fn().mockResolvedValue(mockResponse);

      renderWithAuthProvider();

      await user.click(screen.getByText('Register'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Username already exists');
      });
    });
  });

  describe('Logout Functionality', () => {
    beforeEach(() => {
      // Set initial logged in state
      localStorage.setItem('auth-token', 'test-token');

      const mockStatusResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ needsSetup: false }),
      };
      const mockUserResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ user: { username: 'testuser' } }),
      };
      api.auth.status = jest.fn().mockResolvedValue(mockStatusResponse);
      api.auth.user = jest.fn().mockResolvedValue(mockUserResponse);
    });

    it('logout clears user and token', async () => {
      const user = userEvent.setup();

      api.auth.logout = jest.fn().mockResolvedValue({ ok: true });

      renderWithAuthProvider();

      // Wait for initial state to load
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('testuser');
      });

      await user.click(screen.getByText('Logout'));

      expect(screen.getByTestId('user')).toHaveTextContent('null');
      expect(screen.getByTestId('token')).toHaveTextContent('null');
      expect(localStorage.getItem('auth-token')).toBeNull();
    });

    it('calls logout endpoint when token exists', async () => {
      const user = userEvent.setup();

      api.auth.logout = jest.fn().mockResolvedValue({ ok: true });

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('testuser');
      });

      await user.click(screen.getByText('Logout'));

      expect(api.auth.logout).toHaveBeenCalled();
    });

    it('handles logout endpoint errors gracefully', async () => {
      const user = userEvent.setup();

      api.auth.logout = jest.fn().mockRejectedValue(new Error('Logout failed'));

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('testuser');
      });

      await user.click(screen.getByText('Logout'));

      // Should still clear local state even if logout endpoint fails
      expect(screen.getByTestId('user')).toHaveTextContent('null');
      expect(screen.getByTestId('token')).toHaveTextContent('null');
    });
  });

  describe('Error Handling', () => {
    it('clears error on successful operations', async () => {
      const user = userEvent.setup();

      // First trigger an error
      api.auth.login = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          json: jest.fn().mockResolvedValue({ error: 'Login failed' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            token: 'success-token',
            user: { username: 'testuser' },
          }),
        });

      renderWithAuthProvider();

      // Trigger failed login
      await user.click(screen.getByText('Login'));
      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Login failed');
      });

      // Trigger successful login
      await user.click(screen.getByText('Login'));
      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('null');
        expect(screen.getByTestId('user')).toHaveTextContent('testuser');
      });
    });
  });

  describe('useAuth Hook Error', () => {
    it('throws error when used outside provider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleError.mockRestore();
    });
  });

  describe('Token Persistence', () => {
    it('restores token from localStorage on mount', async () => {
      localStorage.setItem('auth-token', 'persistent-token');

      const mockStatusResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ needsSetup: false }),
      };
      const mockUserResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ user: { username: 'persistent-user' } }),
      };
      api.auth.status = jest.fn().mockResolvedValue(mockStatusResponse);
      api.auth.user = jest.fn().mockResolvedValue(mockUserResponse);

      renderWithAuthProvider();

      await waitFor(() => {
        expect(api.auth.status).toHaveBeenCalled();
        expect(screen.getByTestId('token')).toHaveTextContent('persistent-token');
      });
    });

    it('handles corrupted localStorage data', async () => {
      localStorage.setItem('auth-token', 'invalid-token');

      const mockStatusResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ needsSetup: false }),
      };
      api.auth.status = jest.fn().mockResolvedValue(mockStatusResponse);

      // Mock user verification to fail
      api.auth.user = jest.fn().mockResolvedValue({ ok: false });

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('null');
        expect(screen.getByTestId('token')).toHaveTextContent('null');
        expect(localStorage.getItem('auth-token')).toBeNull();
      });
    });
  });

  describe('Provider Value', () => {
    it('provides all required context values', async () => {
      const mockStatusResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ needsSetup: false }),
      };
      api.auth.status = jest.fn().mockResolvedValue(mockStatusResponse);

      const TestConsumer = () => {
        const context = useAuth();
        return (
          <div data-testid="context-values">
            <span data-testid="has-login">
              {typeof context.login === 'function' ? 'true' : 'false'}
            </span>
            <span data-testid="has-register">
              {typeof context.register === 'function' ? 'true' : 'false'}
            </span>
            <span data-testid="has-logout">
              {typeof context.logout === 'function' ? 'true' : 'false'}
            </span>
            <span data-testid="has-isLoading">
              {typeof context.isLoading === 'boolean' ? 'true' : 'false'}
            </span>
            <span data-testid="has-needsSetup">
              {typeof context.needsSetup === 'boolean' ? 'true' : 'false'}
            </span>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('has-login')).toHaveTextContent('true');
        expect(screen.getByTestId('has-register')).toHaveTextContent('true');
        expect(screen.getByTestId('has-logout')).toHaveTextContent('true');
        expect(screen.getByTestId('has-isLoading')).toHaveTextContent('true');
        expect(screen.getByTestId('has-needsSetup')).toHaveTextContent('true');
      });
    });
  });
});
