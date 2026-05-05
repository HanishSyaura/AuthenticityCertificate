import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import VerifyPage from './pages/VerifyPage';
import CmsPreviewPage from './pages/CmsPreviewPage';
import AdminLogin from './pages/admin/AdminLogin';
import AdminShell from './components/admin/AdminShell';
import AdminProtected from './components/admin/AdminProtected';
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
          <Route path="records" element={<AdminRecords />} />
          <Route path="epc" element={<AdminEpc />} />
          <Route path="epc/scan" element={<AdminEpcScan />} />
          <Route path="records/:id" element={<AdminRecordDetail />} />
          <Route path="cms" element={<AdminCmsBuilder />} />
          <Route path="certificates" element={<AdminCertificateList />} />
          <Route path="certificates/new" element={<AdminCertificateBuilder />} />
          <Route path="certificates/:id" element={<AdminCertificateBuilder />} />
          <Route path="certificates/:id/design" element={<AdminCertificateDesigner />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
