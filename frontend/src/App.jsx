import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PreferencesProvider } from './context/PreferencesContext'
import { ProjectProvider } from './context/ProjectContext'
import ThemeManager from './components/ThemeManager'
import Layout from './components/Layout'

// Code Splitting - Lazy Loading Pages
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Patients = lazy(() => import('./pages/Patients'));
const PatientDetail = lazy(() => import('./pages/PatientDetail'));
const Appointments = lazy(() => import('./pages/Appointments'));
const ConsultationEnhanced = lazy(() => import('./pages/ConsultationEnhanced'));
const Vaccinations = lazy(() => import('./pages/Vaccinations'));
const Documents = lazy(() => import('./pages/Documents'));
const Users = lazy(() => import('./pages/Users'));
const Clinics = lazy(() => import('./pages/Clinics'));
const Settings = lazy(() => import('./pages/Settings'));
const Referrals = lazy(() => import('./pages/Referrals'));

// Centralized Loader Component for Suspense Fallbacks
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
  </div>
);

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }
  
  return children
}

function App() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <ThemeManager />
        <PreferencesProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              {/* Rest of the routes remain same... */}
              <Route path="/" element={<Suspense fallback={<PageLoader />}><LandingPage /></Suspense>} />
              <Route path="/login" element={<Suspense fallback={<PageLoader />}><Login /></Suspense>} />
              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
                <Route path="/patients" element={<Suspense fallback={<PageLoader />}><Patients /></Suspense>} />
                <Route path="/patients/:id" element={<Suspense fallback={<PageLoader />}><PatientDetail /></Suspense>} />
                <Route path="/appointments" element={<Suspense fallback={<PageLoader />}><Appointments /></Suspense>} />
                <Route path="/consultation/new" element={<ProtectedRoute roles={['admin', 'doctor']}><Suspense fallback={<PageLoader />}><ConsultationEnhanced /></Suspense></ProtectedRoute>} />
                <Route path="/consultation/:id" element={<ProtectedRoute roles={['admin', 'doctor']}><Suspense fallback={<PageLoader />}><ConsultationEnhanced /></Suspense></ProtectedRoute>} />
                <Route path="/vaccinations" element={<Suspense fallback={<PageLoader />}><Vaccinations /></Suspense>} />
                <Route path="/documents" element={<Suspense fallback={<PageLoader />}><Documents /></Suspense>} />
                <Route path="/users" element={<ProtectedRoute roles={['admin']}><Suspense fallback={<PageLoader />}><Users /></Suspense></ProtectedRoute>} />
                <Route path="/clinics" element={<ProtectedRoute roles={['admin']}><Suspense fallback={<PageLoader />}><Clinics /></Suspense></ProtectedRoute>} />
                <Route path="/referrals" element={<ProtectedRoute roles={['admin', 'doctor']}><Suspense fallback={<PageLoader />}><Referrals /></Suspense></ProtectedRoute>} />
                <Route path="/settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </PreferencesProvider>
      </ProjectProvider>
    </AuthProvider>
  )
}

export default App
