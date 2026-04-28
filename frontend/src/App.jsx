import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import VerifyPage from './pages/VerifyPage';
import AdminLogin from './pages/admin/AdminLogin';
import AdminShell from './components/admin/AdminShell';
import AdminProtected from './components/admin/AdminProtected';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCmsBuilder from './pages/admin/AdminCmsBuilder';
import AdminCertificateTemplateBuilder from './pages/admin/AdminCertificateTemplateBuilder';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminRecords from './pages/admin/AdminRecords';
import AdminRecordDetail from './pages/admin/AdminRecordDetail';
import AdminUsers from './pages/admin/AdminUsers';
import AdminAudit from './pages/admin/AdminAudit';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<VerifyPage />} />
        <Route path="/verify/:id" element={<VerifyPage />} />

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
          <Route path="records" element={<AdminRecords />} />
          <Route path="records/:id" element={<AdminRecordDetail />} />
          <Route path="cms" element={<AdminCmsBuilder />} />
          <Route path="cert-templates" element={<AdminCertificateTemplateBuilder />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="audit" element={<AdminAudit />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
