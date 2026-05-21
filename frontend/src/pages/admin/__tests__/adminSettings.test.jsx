import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminSettings from '../AdminSettings';
import useAdminAuthStore from '../../../store/useAdminAuthStore';

const createAdminApiMock = vi.fn();
vi.mock('../../../utils/adminApi', () => ({
  createAdminApi: (...args) => createAdminApiMock(...args)
}));

function setupApi({ meRole = 'super_admin' } = {}) {
  const api = {
    get: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    post: vi.fn()
  };

  api.get.mockImplementation((path) => {
    if (path === '/auth/me') {
      return Promise.resolve({
        data: { data: { user: { id: 1, name: 'Admin', email: 'admin@local.test', role: meRole } } }
      });
    }
    if (path === '/settings') {
      return Promise.resolve({
        data: {
          data: {
            organization: { id: 1, name: 'Main Organization', code: 'MAIN' },
            settings: { defaultLocale: 'en', defaultTimezone: 'UTC', maintenanceMode: false, smtpHost: null, smtpPassSet: false }
          }
        }
      });
    }
    return Promise.reject(new Error('Unknown path'));
  });

  api.patch.mockResolvedValue({
    data: { data: { user: { id: 1, name: 'Admin', email: 'admin@local.test', role: meRole } } }
  });

  api.put.mockResolvedValue({
    data: {
      data: {
        organization: { id: 1, name: 'Main Organization', code: 'MAIN' },
        settings: { defaultLocale: 'en', defaultTimezone: 'UTC', maintenanceMode: false, smtpHost: null, smtpPassSet: false }
      }
    }
  });

  api.post.mockResolvedValue({ data: { success: true, data: { ok: true } } });

  createAdminApiMock.mockReturnValue(api);
  return api;
}

describe('AdminSettings', () => {
  beforeEach(() => {
    createAdminApiMock.mockReset();
    try {
      localStorage.setItem('ac_admin_settings_tab_v1', 'profile');
    } catch {
      void 0;
    }
    useAdminAuthStore.setState({
      token: 'test-token',
      user: { id: 1, email: 'admin@local.test', name: 'Admin', role: 'super_admin' }
    });
  });

  it('renders profile and system cards after loading', async () => {
    setupApi({ meRole: 'super_admin' });
    render(<AdminSettings />);

    expect(screen.getByText(/Settings/i)).toBeInTheDocument();

    await screen.findByText(/Profile settings/i);
    const saveProfile = screen.getByRole('button', { name: /Save Changes/i });
    expect(saveProfile).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /^System$/i }));
    await screen.findByText(/System settings/i);
  });

  it('disables email editing for operator', async () => {
    useAdminAuthStore.setState({
      token: 'test-token',
      user: { id: 2, email: 'op@local.test', name: 'Operator', role: 'operator' }
    });
    setupApi({ meRole: 'operator' });
    render(<AdminSettings />);

    await screen.findByText(/Profile settings/i);
    const email = screen.getByLabelText(/Email/i);
    expect(email).toBeDisabled();
  });

  it('prevents system edits for admin role', async () => {
    useAdminAuthStore.setState({
      token: 'test-token',
      user: { id: 3, email: 'admin2@local.test', name: 'Admin2', role: 'admin' }
    });
    setupApi({ meRole: 'admin' });
    render(<AdminSettings />);

    await screen.findByText(/Profile settings/i);
    fireEvent.click(screen.getByRole('button', { name: /^System$/i }));
    await screen.findByText(/System settings/i);
    const saveSystem = screen.getByRole('button', { name: /Save Settings/i });
    expect(saveSystem).toBeDisabled();
  });

  it('validates password change requires current password', async () => {
    setupApi({ meRole: 'super_admin' });
    render(<AdminSettings />);

    await screen.findByText(/Profile settings/i);
    const newPassword = screen.getByLabelText(/^New password$/i);
    fireEvent.change(newPassword, { target: { value: 'newpassword123' } });

    const saveProfile = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveProfile);

    await waitFor(() => {
      expect(screen.getByText(/Current password is required/i)).toBeInTheDocument();
    });
  });
});
