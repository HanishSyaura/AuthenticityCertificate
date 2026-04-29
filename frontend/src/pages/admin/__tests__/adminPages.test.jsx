import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminShell from '../../../components/admin/AdminShell';
import AdminUsers from '../AdminUsers';
import useAdminAuthStore from '../../../store/useAdminAuthStore';

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
    useAdminAuthStore.setState({
      token: 'test-token',
      user: { id: 1, email: 'admin@local.test', name: 'Admin', role: 'super_admin' },
    });
  });

  it('shows new nav items', () => {
    renderWithRoute('/admin', <AdminShell />);
    expect(screen.getByText(/Records/i)).toBeInTheDocument();
    expect(screen.getByText(/Audit/i)).toBeInTheDocument();
    expect(screen.getByText(/Users/i)).toBeInTheDocument();
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
});
