import { useState } from 'react';
import { useStore } from '../store';
import { Button } from '../components/ui';
import AdminStudents from './AdminStudents';
import AdminTeachers from './AdminTeachers';
import SubjectsList from './SubjectsList';
import ExamsManager from './ExamsManager';
import ResultsView from './ResultsView';
import ReportsView from './ReportsView';
import { AnalyticsView } from './DashboardViews';
import BrandingForm from './BrandingForm';
import SettingsForm from './SettingsForm';
import BackupRestore from './BackupRestore';
import MyExams from './MyExams';
import AttendanceView from './AttendanceView';
import DashboardHome from './DashboardViews';

export default function Dashboard() {
  const { branding, currentUser, currentRole, logout } = useStore();
  
  const navItems = currentRole === 'admin' 
    ? ['Dashboard', 'Students', 'Teachers', 'Subjects', 'Exams', 'Results', 'Reports', 'Analytics', 'Branding', 'Settings', 'Backup']
    : currentRole === 'teacher'
    ? ['Dashboard', 'My Classes', 'Exams', 'Question Bank', 'Results', 'Attendance', 'Reports']
    : ['Dashboard', 'My Exams', 'My Results'];
    
  const [activeTab, setActiveTab] = useState(navItems[0]);

  const renderContent = () => {
    switch (activeTab) {
      case 'Dashboard': return <DashboardHome />;
      case 'Students': return <AdminStudents />;
      case 'Teachers': return <AdminTeachers />;
      case 'Subjects': return <SubjectsList />;
      case 'Exams': return <ExamsManager />;
      case 'Results': return <ResultsView studentOnly={false} />;
      case 'My Results': return <ResultsView studentOnly={true} />;
      case 'Reports': return <ReportsView />;
      case 'Analytics': return <AnalyticsView />;
      case 'Branding': return <BrandingForm />;
      case 'Settings': return <SettingsForm />;
      case 'Backup': return <BackupRestore />;
      case 'My Exams': return <MyExams />;
      case 'Attendance': return <AttendanceView />;
      case 'My Classes': return <MyClassesView />;
      case 'Question Bank': return (
        <div className="bg-[var(--card)] p-5 rounded-[var(--radius)] shadow-[var(--shadow)]">
          <h3 className="mt-0 text-xl font-bold">Question Bank</h3>
          <p className="text-slate-500">Questions are attached directly to exams in this standalone version. Use Create Exam to add questions.</p>
        </div>
      );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col md:flex-row">
      <aside 
        className="md:fixed md:left-0 md:top-0 md:bottom-0 w-full md:w-[250px] p-[18px] overflow-auto text-white flex flex-col"
        style={{ backgroundColor: branding.primary }}
      >
        <div className="flex items-center gap-3 mb-[20px] my-[5px]">
          {branding.logo && (
            <img 
              src={branding.logo} 
              alt="Logo" 
              className="w-10 h-10 object-cover rounded-full bg-white"
            />
          )}
          <div className="text-xl font-extrabold">{branding.schoolName}</div>
        </div>
        <div className="flex flex-col gap-1 flex-1">
          {navItems.map(item => (
            <div 
              key={item}
              className={`p-[11px_12px] rounded-[9px] cursor-pointer transition-colors ${activeTab === item ? 'text-slate-900' : 'hover:text-slate-900'}`}
              style={{ backgroundColor: activeTab === item ? branding.secondary : 'transparent' }}
              onMouseEnter={(e) => {
                if (activeTab !== item) e.currentTarget.style.backgroundColor = branding.secondary;
              }}
              onMouseLeave={(e) => {
                if (activeTab !== item) e.currentTarget.style.backgroundColor = 'transparent';
              }}
              onClick={() => setActiveTab(item)}
            >
              {item}
            </div>
          ))}
        </div>
        <Button variant="secondary" className="w-full mt-5" onClick={logout}>
          Logout
        </Button>
      </aside>
      
      <main className="md:ml-[250px] flex-1 p-4 md:p-[25px]">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-bold m-0">{activeTab}</h1>
            <span className="text-slate-500 text-sm">{currentUser?.name} · {currentRole}</span>
          </div>
        </div>
        
        {renderContent()}
      </main>
    </div>
  );
}

function MyClassesView() {
  const { data, currentUser } = useStore();
  const classes = (currentUser as any).classes || [];
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[15px]">
      {classes.map((c: string) => (
        <div key={c} className="bg-[var(--card)] p-[18px] rounded-[var(--radius)] shadow-[var(--shadow)]">
          <h3 className="m-0 mt-1">{c}</h3>
          <p className="text-slate-500 mb-1">{data.students.filter(s => s.class === c).length} students</p>
        </div>
      ))}
    </div>
  );
}
