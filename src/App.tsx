import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { NotificationProvider } from './context/NotificationContext.tsx';
import { Layout } from './components/Layout.tsx';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';
import { Login } from './pages/Login.tsx';
import { Leads } from './pages/Leads.tsx';
import { LeadDetails } from './pages/LeadDetails.tsx';
import { Agents } from './pages/Agents.tsx';
import { Attendance } from './pages/Attendance.tsx';
import { CommandCenter } from './pages/CommandCenter.tsx';
import { AgentDrilldown } from './pages/AgentDrilldown.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { AgentDashboard } from './pages/AgentDashboard.tsx';
import { TradeToday } from './pages/TradeToday.tsx';
import { Payments } from './pages/Payments.tsx';
import { useSocket } from './hooks/useSocket.ts';

/** Home `/`: admin overview vs agent execution dashboard. */
const HomeRoute = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Dashboard />;
  return <AgentDashboard />;
};

const AppContent = () => {
  useSocket();
  return (
    <Layout>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={
          <ProtectedRoute>
            <HomeRoute />
          </ProtectedRoute>
        } />

        {/* Agent primary surface: Call Queue */}
        <Route path="/today-trades" element={
          <ProtectedRoute roles={['agent']}>
            <TradeToday />
          </ProtectedRoute>
        } />

        <Route path="/leads" element={
          <ProtectedRoute>
            <Leads />
          </ProtectedRoute>
        } />
        <Route path="/leads/:id" element={
          <ProtectedRoute>
            <LeadDetails />
          </ProtectedRoute>
        } />

        {/* Admin: Command Center is the landing */}
        <Route path="/payments" element={
          <ProtectedRoute roles={['admin']}>
            <Payments />
          </ProtectedRoute>
        } />

        <Route path="/command-center" element={
          <ProtectedRoute roles={['admin']}>
            <CommandCenter />
          </ProtectedRoute>
        } />

        {/* Admin: Full-page Agent Drilldown (for deep investigation) */}
        <Route path="/agents/:id/summary" element={
          <ProtectedRoute roles={['admin']}>
            <AgentDrilldown />
          </ProtectedRoute>
        } />

        <Route path="/agents" element={
          <ProtectedRoute roles={['admin']}>
            <Agents />
          </ProtectedRoute>
        } />

        <Route path="/attendance" element={
          <ProtectedRoute roles={['admin']}>
            <Attendance />
          </ProtectedRoute>
        } />
      </Routes>
    </Layout>
  );
};

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
}
