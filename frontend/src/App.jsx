import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import VerifyPage from './pages/VerifyPage';
import CmsPreviewPage from './pages/CmsPreviewPage';
import AdminLogin from './pages/admin/AdminLogin';
import AdminShell from './components/admin/AdminShell';
import AdminProtected from './components/admin/AdminProtected';
import RequireAnyPermission from './components/admin/RequireAnyPermission';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCmsBuilder from './pages/admin/AdminCmsBuilder';
import AdminRecords from './pages/admin/AdminRecords';
import AdminRecordDetail from './pages/admin/AdminRecordDetail';
import AdminUsers from './pages/admin/AdminUsers';
import AdminGuide from './pages/admin/AdminGuide';
import AdminEpc from './pages/admin/AdminEpc';
import AdminSettings from './pages/admin/AdminSettings';
import AdminCertificateList from './pages/admin/AdminCertificateList';
import AdminCertificateBuilder from './pages/admin/AdminCertificateBuilder';
import AdminCertificateDesigner from './pages/admin/AdminCertificateDesigner';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminFraud from './pages/admin/AdminFraud';
import AdminAudit from './pages/admin/AdminAudit';
import AdminIntegrations from './pages/admin/AdminIntegrations';
import AdminMedia from './pages/admin/AdminMedia';
import AdminBulkImport from './pages/admin/AdminBulkImport';
import AdminIdentities from './pages/admin/AdminIdentities';
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
              <RequireAnyPermission anyOf={['products.read', 'products.write']}>
                <AdminRecords />
              </RequireAnyPermission>
            }
          />
          <Route
            path="records/:id"
            element={
              <RequireAnyPermission anyOf={['products.read', 'products.write']}>
                <AdminRecordDetail />
              </RequireAnyPermission>
            }
          />
          <Route
            path="epc"
            element={
              <RequireAnyPermission anyOf={['epc.read', 'epc.write']}>
                <AdminEpc />
              </RequireAnyPermission>
            }
          />
          <Route
            path="cms"
            element={
              <RequireAnyPermission anyOf={['cms.read', 'cms.write', 'cms.publish']}>
                <AdminCmsBuilder />
              </RequireAnyPermission>
            }
          />
          <Route
            path="certificates"
            element={
              <RequireAnyPermission anyOf={['certificates.read', 'certificates.write', 'templates.read', 'templates.write']}>
                <AdminCertificateList />
              </RequireAnyPermission>
            }
          />
          <Route
            path="certificates/new"
            element={
              <RequireAnyPermission anyOf={['certificates.write', 'templates.read', 'templates.write']}>
                <AdminCertificateBuilder />
              </RequireAnyPermission>
            }
          />
          <Route
            path="certificates/:id"
            element={
              <RequireAnyPermission anyOf={['certificates.read', 'certificates.write', 'templates.read', 'templates.write']}>
                <AdminCertificateBuilder />
              </RequireAnyPermission>
            }
          />
          <Route
            path="certificates/:id/design"
            element={
              <RequireAnyPermission anyOf={['templates.read', 'templates.write']}>
                <AdminCertificateDesigner />
              </RequireAnyPermission>
            }
          />
          <Route
            path="analytics"
            element={
              <RequireAnyPermission anyOf={['analytics.read']}>
                <AdminAnalytics />
              </RequireAnyPermission>
            }
          />
          <Route
            path="fraud"
            element={
              <RequireAnyPermission anyOf={['fraud.read', 'fraud.write']}>
                <AdminFraud />
              </RequireAnyPermission>
            }
          />
          <Route
            path="audit"
            element={
              <RequireAnyPermission anyOf={['audit.read']}>
                <AdminAudit />
              </RequireAnyPermission>
            }
          />
          <Route
            path="integrations"
            element={
              <RequireAnyPermission anyOf={['integrations.read', 'integrations.write']}>
                <AdminIntegrations />
              </RequireAnyPermission>
            }
          />
          <Route
            path="media"
            element={
              <RequireAnyPermission anyOf={['media.read', 'media.write']}>
                <AdminMedia />
              </RequireAnyPermission>
            }
          />
          <Route
            path="bulk"
            element={
              <RequireAnyPermission anyOf={['bulk.read', 'bulk.write']}>
                <AdminBulkImport />
              </RequireAnyPermission>
            }
          />
          <Route
            path="identities"
            element={
              <RequireAnyPermission anyOf={['identities.read', 'identities.write']}>
                <AdminIdentities />
              </RequireAnyPermission>
            }
          />
          <Route
            path="users"
            element={
              <RequireAnyPermission anyOf={['users.manage', 'access.manage']}>
                <AdminUsers />
              </RequireAnyPermission>
            }
          />
          <Route
            path="settings"
            element={
              <RequireAnyPermission anyOf={['settings.read', 'settings.write']}>
                <AdminSettings />
              </RequireAnyPermission>
            }
          />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
