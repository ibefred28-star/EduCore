import { useEffect } from 'react';
import { useStore } from './store';
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import CBT from './views/CBT';
import SuperAdminDashboard from './views/SuperAdminDashboard';
import { ToastRenderer } from './components/ui';

export default function App() {
  const { currentUser, currentRole, activeExamId, branding, authLoading } = useStore();

  useEffect(() => {
    // Inject branding CSS variables at root level for global usage
    document.documentElement.style.setProperty('--primary', branding.primary);
    document.documentElement.style.setProperty('--secondary', branding.secondary);
    document.documentElement.style.setProperty('--accent', branding.accent);
    document.title = branding.schoolName;
  }, [branding]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
        <div 
          className="w-10 h-10 border-4 rounded-full animate-spin"
          style={{ borderColor: `${branding.primary}20`, borderTopColor: branding.primary }}
        />
        <p className="text-sm text-slate-500 font-medium">Verifying session...</p>
      </div>
    );
  }

  return (
    <>
      <ToastRenderer />
      
      {!currentUser && <Login />}
      
      {currentUser && currentRole === 'superadmin' && <SuperAdminDashboard />}

      {currentUser && currentRole !== 'superadmin' && !activeExamId && <Dashboard />}
      
      {currentUser && currentRole !== 'superadmin' && activeExamId && <CBT />}
    </>
  );
}
