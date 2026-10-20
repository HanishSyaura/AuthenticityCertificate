import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminShell from '../../../components/admin/AdminShell';
import AdminUsers from '../AdminUsers';
import useAdminAuthStore from '../../../store/useAdminAuthStore';
import useAdminSettingsStore from '../../../store/useAdminSettingsStore';
import useI18nStore from '../../../store/useI18nStore';

function renderWithRoute(path, element) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={element} />
        <Route path="/admin/users" element={<AdminUsers />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('admin pages', () => {
  beforeEach(() => {
    useI18nStore.getState().setLang('en');
    useAdminAuthStore.setState({
      token: 'test-token',
      user: { id: 1, email: 'admin@local.test', name: 'Admin', role: 'super_admin' },
    });
    useAdminSettingsStore.setState({
      organization: null,
      settings: null,
      loading: false,
      error: null,
      lastSyncAt: null,
    });
  });

  it('shows new nav items', () => {
    renderWithRoute('/admin', <AdminShell />);
    expect(screen.getByText(/Getting Started/i)).toBeInTheDocument();
    expect(screen.getByText(/Products\s*&\s*Batches/i)).toBeInTheDocument();
    expect(screen.getByText(/EPC Management/i)).toBeInTheDocument();
    expect(screen.getByText(/Certificates\s*&\s*identity/i)).toBeInTheDocument();
    expect(screen.getByText(/Certificate Management/i)).toBeInTheDocument();
    expect(screen.getByText(/Content/i)).toBeInTheDocument();
    expect(screen.getByText(/Landing Page Design/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Settings/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Users\s*&\s*Roles/i)).toBeInTheDocument();
  });

  it('guards Users page for non-super-admin', () => {
    useAdminAuthStore.setState({
      token: 'test-token',
      user: { id: 2, email: 'op@local.test', name: 'Operator', role: 'admin' },
    });
    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route path="/admin/users" element={<AdminUsers />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText(/Super Admin/i)).toBeInTheDocument();
  });

  it('shows sanitized fallback branding in admin header', () => {
    useAdminSettingsStore.setState({
      organization: { id: 1, name: 'DAMADINGJIYANWO', code: 'DAMADINGJIYANWO' },
      settings: { appTitle: 'Zora Pro PAC', logoUrl: null, faviconUrl: null, themePrimaryHex: '#1a1939' },
      loading: false,
      error: null,
      lastSyncAt: Date.now(),
    });

    renderWithRoute('/admin', <AdminShell />);
    expect(screen.getByText('CLB Holdings Berhad')).toBeInTheDocument();
    expect(screen.getByText('Zora Pro PAC')).toBeInTheDocument();
  });
});
