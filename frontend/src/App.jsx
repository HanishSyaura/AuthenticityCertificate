import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import VerifyPage from './pages/VerifyPage';
import CmsPreviewPage from './pages/CmsPreviewPage';
import AdminLogin from './pages/admin/AdminLogin';
import AdminShell from './components/admin/AdminShell';
import AdminProtected from './components/admin/AdminProtected';
import AdminRequirePermission from './components/admin/AdminRequirePermission';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCmsBuilder from './pages/admin/AdminCmsBuilder';
import AdminRecords from './pages/admin/AdminRecords';
import AdminRecordDetail from './pages/admin/AdminRecordDetail';
import AdminUsers from './pages/admin/AdminUsers';
import AdminGuide from './pages/admin/AdminGuide';
import AdminEpc from './pages/admin/AdminEpc';
import AdminEpcScan from './pages/admin/AdminEpcScan';
import AdminSettings from './pages/admin/AdminSettings';
import AdminCertificateList from './pages/admin/AdminCertificateList';
import AdminCertificateBuilder from './pages/admin/AdminCertificateBuilder';
import AdminCertificateDesigner from './pages/admin/AdminCertificateDesigner';
import NotFound from './pages/NotFound';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<VerifyPage />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/verify/:id" element={<VerifyPage />} />
        <Route path="/preview/cms" element={<CmsPreviewPage />} />

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <AdminProtected>
              <AdminShell />
            </AdminProtected>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="guide" element={<AdminGuide />} />
          <Route
            path="records"
            element={
              <AdminRequirePermission anyOf={['products.read']}>
                <AdminRecords />
              </AdminRequirePermission>
            }
          />
          <Route
            path="records/:id"
            element={
              <AdminRequirePermission anyOf={['products.read']}>
                <AdminRecordDetail />
              </AdminRequirePermission>
            }
          />
          <Route
            path="epc"
            element={
              <AdminRequirePermission
                anyOf={[
                  'epc.batch.view',
                  'epc.batch.create',
                  'epc.scan.access',
                  'epc.certificate.view',
                  'epc.export.xlsx',
                  'epc.encoding',
                  'epc.sequence.reset',
                  'epc.delete',
                  'epc.production.access',
                  'epc.override'
                ]}
              >
                <AdminEpc />
              </AdminRequirePermission>
            }
          />
          <Route
            path="epc/scan"
            element={
              <AdminRequirePermission anyOf={['epc.scan.access']}>
                <AdminEpcScan />
              </AdminRequirePermission>
            }
          />
          <Route
            path="cms"
            element={
              <AdminRequirePermission anyOf={['cms.read']}>
                <AdminCmsBuilder />
              </AdminRequirePermission>
            }
          />
          <Route
            path="certificates"
            element={
              <AdminRequirePermission anyOf={['certificates.read', 'certificates.write']}>
                <AdminCertificateList />
              </AdminRequirePermission>
            }
          />
          <Route
            path="certificates/new"
            element={
              <AdminRequirePermission anyOf={['certificates.write']}>
                <AdminCertificateBuilder />
              </AdminRequirePermission>
            }
          />
          <Route
            path="certificates/:id"
            element={
              <AdminRequirePermission anyOf={['certificates.read', 'certificates.write']}>
                <AdminCertificateBuilder />
              </AdminRequirePermission>
            }
          />
          <Route
            path="certificates/:id/design"
            element={
              <AdminRequirePermission anyOf={['templates.read', 'templates.write']}>
                <AdminCertificateDesigner />
              </AdminRequirePermission>
            }
          />
          <Route
            path="users"
            element={
              <AdminRequirePermission anyOf={['users.manage', 'access.manage']}>
                <AdminUsers />
              </AdminRequirePermission>
            }
          />
          <Route
            path="settings"
            element={
              <AdminRequirePermission anyOf={['settings.read', 'settings.write']}>
                <AdminSettings />
              </AdminRequirePermission>
            }
          />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
