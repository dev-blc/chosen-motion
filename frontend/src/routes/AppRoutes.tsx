import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Login from '@/features/auth/pages/Login';
import Register from '@/features/auth/pages/Register';
import AdminDashboard from '@/features/admin/pages/AdminDashboard';
import PatientDashboard from '@/features/patient/pages/PatientDashboard';
import TrackerSkeleton from '@/features/motion-tracking/components/TrackerSkeleton';
import { Loader2 } from 'lucide-react';

// ==========================================
// Role Protected Route Guard
// ==========================================
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: Array<'admin' | 'patient'>;
}> = ({ children, allowedRoles }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-light dark:bg-brand-dark">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-primary-500 animate-spin" />
          <span className="text-sm text-slate-500 font-semibold uppercase tracking-wider">Validating Credentials...</span>
        </div>
      </div>
    );
  }

  // Redirect to login if user session doesn't exist
  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to corresponding page if user doesn't have the required role
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    const defaultRoute = profile.role === 'admin' ? '/admin' : '/patient';
    return <Navigate to={defaultRoute} replace />;
  }

  return <>{children}</>;
};

// ==========================================
// Route Entrypoint Aggregator
// ==========================================
const AppRoutes: React.FC = () => {
  const { user, profile, loading } = useAuth();

  return (
    <Routes>
      {/* Public Pages */}
      <Route
        path="/login"
        element={
          user && profile && !loading ? (
            <Navigate to={profile.role === 'admin' ? '/admin' : '/patient'} replace />
          ) : (
            <Login />
          )
        }
      />
      <Route
        path="/register"
        element={
          user && profile && !loading ? (
            <Navigate to={profile.role === 'admin' ? '/admin' : '/patient'} replace />
          ) : (
            <Register />
          )
        }
      />

      {/* Protected Patient Routes */}
      <Route
        path="/patient"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <PatientDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tracker"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <TrackerSkeleton />
          </ProtectedRoute>
        }
      />

      {/* Protected Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Fallback Home Route */}
      <Route
        path="/"
        element={
          loading ? (
            <div className="min-h-screen flex items-center justify-center bg-brand-light dark:bg-brand-dark">
              <Loader2 className="h-10 w-10 text-primary-500 animate-spin" />
            </div>
          ) : !user ? (
            <Navigate to="/login" replace />
          ) : (
            <Navigate to={profile?.role === 'admin' ? '/admin' : '/patient'} replace />
          )
        }
      />

      {/* Wildcard Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
