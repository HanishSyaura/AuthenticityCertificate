import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminSettings from '../AdminSettings';
import useAdminAuthStore from '../../../store/useAdminAuthStore';
import useI18nStore from '../../../store/useI18nStore';

const createAdminApiMock = vi.fn();
vi.mock('../../../utils/adminApi', () => ({
  createAdminApi: (...args) => createAdminApiMock(...args)
}));

function setupApi({ meRole = 'super_admin', organization = { id: 1, name: 'Main Organization', code: 'MAIN' } } = {}) {
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
    if (path === '/settings/') {
      return Promise.resolve({
        data: {
          data: {
            organization,
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
        organization,
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
    useI18nStore.getState().setLang('en');
    useAdminAuthStore.setState({
      token: 'test-token',
      user: { id: 1, email: 'admin@local.test', name: 'Admin', role: 'super_admin' }
    });
  });

  it('renders profile card and remaining tabs after loading', async () => {
    setupApi({ meRole: 'super_admin' });
    render(<AdminSettings />);

    expect(screen.getByText(/Settings/i)).toBeInTheDocument();

    await screen.findByText(/Profile settings/i);
    const saveProfile = screen.getByRole('button', { name: /Save Changes/i });
    expect(saveProfile).toBeDisabled();

    expect(screen.getByRole('button', { name: /^System$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Email$/i })).toBeInTheDocument();
    expect(document.getElementById('profile-language')).toBeInTheDocument();
  });

  it('disables email editing for operator', async () => {
    useAdminAuthStore.setState({
      token: 'test-token',
      user: { id: 2, email: 'op@local.test', name: 'Operator', role: 'operator' }
    });
    setupApi({ meRole: 'operator' });
    render(<AdminSettings />);

    await screen.findByText(/Profile settings/i);
    const email = document.getElementById('profile-email');
    expect(email).toBeDisabled();
  });

  it('shows system label for the branding tab', async () => {
    useAdminAuthStore.setState({
      token: 'test-token',
      user: { id: 3, email: 'admin2@local.test', name: 'Admin2', role: 'admin' }
    });
    setupApi({ meRole: 'admin' });
    render(<AdminSettings />);

    await screen.findByText(/Profile settings/i);
    expect(screen.getByRole('button', { name: /^System$/i })).toBeInTheDocument();
  });

  it('keeps legacy branding placeholder fields blank in branding settings', async () => {
    setupApi({
      organization: { id: 1, name: 'DAMADINGJIYANWO', code: 'DAMADINGJIYANWO' }
    });
    render(<AdminSettings />);

    await screen.findByText(/Profile settings/i);
    fireEvent.click(screen.getByRole('button', { name: /^System$/i }));
    await screen.findByText(/Branding & Content/i);

    expect(document.getElementById('branding-organization-name')).toHaveValue('');
    expect(document.getElementById('branding-organization-code')).toHaveValue('');
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

  it('updates display language from profile preferences', async () => {
    const api = setupApi({ meRole: 'super_admin' });
    render(<AdminSettings />);

    await screen.findByText(/Profile settings/i);
    fireEvent.change(document.getElementById('profile-language'), { target: { value: 'ms' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/Profile updated|Profil dikemas kini/i)).toBeInTheDocument();
    });
    expect(useI18nStore.getState().lang).toBe('ms');
    expect(api.patch).not.toHaveBeenCalled();
  });
});
