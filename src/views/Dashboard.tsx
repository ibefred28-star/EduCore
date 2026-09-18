import { useState } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Select } from '../components/ui';
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
import { isStudentInTeacherClasses } from '../lib/classUtils';
import { CLASS_OPTIONS } from '../constants';

export default function Dashboard() {
  const { branding, currentUser, currentRole, logout, data } = useStore();
  
  const teacher = currentRole === 'teacher' 
    ? data.teachers.find(t => (t.id || '').trim().toLowerCase() === (currentUser?.id || '').trim().toLowerCase()) || (currentUser as any)
    : null;
  const teacherClasses = teacher?.classes || [];

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
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-slate-500 text-sm">{currentUser?.name} · {currentRole}</span>
              {currentRole === 'teacher' && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Assigned: {teacherClasses.length > 0 ? teacherClasses.join(', ') : 'None assigned'}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {renderContent()}
      </main>
    </div>
  );
}

function MyClassesView() {
  const { data, currentUser, updateData } = useStore();
  const showToast = useToastStore(s => s.showToast);
  const [newClass, setNewClass] = useState('Primary 5');

  const teacher = data.teachers.find(t => (t.id || '').trim().toLowerCase() === (currentUser?.id || '').trim().toLowerCase()) || (currentUser as any);
  const classes = teacher?.classes || [];

  const removeClass = (className: string) => {
    updateData(draft => {
      const t = draft.teachers.find(x => (x.id || '').trim().toLowerCase() === (currentUser?.id || '').trim().toLowerCase());
      if (t) {
        t.classes = (t.classes || []).filter(c => c !== className);
      }
    });
    showToast(`Removed ${className} from your classes`);
  };

  const addClass = (className: string) => {
    if (!className) return;
    updateData(draft => {
      const t = draft.teachers.find(x => (x.id || '').trim().toLowerCase() === (currentUser?.id || '').trim().toLowerCase());
      if (t) {
        if (!t.classes) t.classes = [];
        if (!t.classes.includes(className)) {
          t.classes.push(className);
        }
      }
    });
    showToast(`Added ${className} to your classes`);
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold m-0 text-slate-800">My Assigned Teaching Classes</h3>
          <p className="text-sm text-slate-500 m-0 mt-0.5">
            You only see students, attendance records, test results, and report cards for your assigned classes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select 
            value={newClass} 
            onChange={e => setNewClass(e.target.value)}
            className="w-40 text-sm"
          >
            {CLASS_OPTIONS.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <Button onClick={() => addClass(newClass)}>+ Add Class</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
        {classes.map((c: string) => {
          const classStudents = data.students.filter(s => isStudentInTeacherClasses(s.class, [c]));
          return (
            <div key={c} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-xl font-bold m-0 text-slate-800">{c}</h3>
                  <button 
                    onClick={() => removeClass(c)}
                    title={`Remove ${c} from my classes`}
                    className="text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1 rounded transition-colors font-medium cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
                <p className="text-sm font-semibold text-indigo-600 mb-3">
                  {classStudents.length} student{classStudents.length !== 1 ? 's' : ''} enrolled
                </p>

                {classStudents.length > 0 ? (
                  <div className="space-y-1.5 border-t border-slate-100 pt-3 max-h-48 overflow-y-auto">
                    {classStudents.map(s => (
                      <div key={s.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-50 hover:bg-slate-100">
                        <span className="font-medium text-slate-700">{s.name}</span>
                        <span className="text-slate-400 font-mono">{s.class}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic border-t border-slate-100 pt-2">
                    No students currently registered in this class.
                  </p>
                )}
              </div>
            </div>
          );
        })}
        {!classes.length && (
          <div className="col-span-full bg-amber-50 border border-amber-200 text-amber-800 p-6 rounded-2xl text-center">
            <p className="font-semibold m-0 text-base">No teaching classes assigned yet.</p>
            <p className="text-sm text-amber-700 mt-1 mb-3">Please select your teaching class above (e.g. Primary 5) or contact the school administrator.</p>
            <Button onClick={() => addClass('Primary 5')}>Assign Primary 5</Button>
          </div>
        )}
      </div>
    </div>
  );
}

