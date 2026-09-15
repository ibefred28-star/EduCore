import { useEffect } from 'react';
import { useStore } from './store';
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import CBT from './views/CBT';
import { ToastRenderer } from './components/ui';

export default function App() {
  const { currentUser, activeExamId, branding } = useStore();

  useEffect(() => {
    // Inject branding CSS variables at root level for global usage
    document.documentElement.style.setProperty('--primary', branding.primary);
    document.documentElement.style.setProperty('--secondary', branding.secondary);
    document.documentElement.style.setProperty('--accent', branding.accent);
    document.title = branding.schoolName;
  }, [branding]);

  return (
    <>
      <ToastRenderer />
      
      {!currentUser && <Login />}
      
      {currentUser && !activeExamId && <Dashboard />}
      
      {currentUser && activeExamId && <CBT />}
    </>
  );
}
