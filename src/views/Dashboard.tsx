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
import AnalyticsView from './AnalyticsView';
import BrandingForm from './BrandingForm';
import SettingsForm from './SettingsForm';
import BackupRestore from './BackupRestore';
import MyExams from './MyExams';
import AttendanceView from './AttendanceView';
import DashboardHome from './DashboardViews';
import QuestionBankView from './QuestionBankView';
import LiveExamMonitoring from './LiveExamMonitoring';
import { isStudentInTeacherClasses } from '../lib/classUtils';
import { CLASS_OPTIONS } from '../constants';
import TeacherCAScoreEntry from './TeacherCAScoreEntry';
import CAReportCardView from './CAReportCardView';

export default function Dashboard() {
  const { branding, currentUser, currentRole, logout, data } = useStore();
  
  const teacher = currentRole === 'teacher' 
    ? data.teachers.find(t => (t.id || '').trim().toLowerCase() === (currentUser?.id || '').trim().toLowerCase()) || (currentUser as any)
    : null;
  const teacherClasses = teacher?.classes || [];

  interface NavItemDef {
    id: string;
    label: string;
    sub?: boolean;
    icon?: string;
  }

  interface NavCategoryDef {
    category?: string;
    items: NavItemDef[];
  }

  const navGroups: NavCategoryDef[] = currentRole === 'admin' 
    ? [
        {
          items: [{ id: 'Dashboard', label: 'Dashboard' }]
        },
        {
          category: 'Academics & CBT',
          items: [
            { id: 'Students', label: 'Students' },
            { id: 'Teachers', label: 'Teachers' },
            { id: 'Subjects', label: 'Subjects' },
            { id: 'CA Score Entry', label: 'CA Score Entry' },
            { id: 'Question Bank', label: 'Question Bank' },
            { id: 'Exams', label: 'Exams' },
            { id: 'Live Exam', label: 'Live Exam' },
            { id: 'Results', label: 'Results' },
            { id: 'Attendance', label: 'Attendance' }
          ]
        },
        {
          category: 'Reports & Assessments',
          items: [
            { id: 'Reports Hub', label: 'Reports Hub' },
            { id: 'CA 1 Report Card', label: 'CA 1 Report Card', sub: true },
            { id: 'CA 2 Report Card', label: 'CA 2 Report Card', sub: true },
            { id: 'Combined CA Report', label: 'Combined CA Report', sub: true },
            { id: 'Academic Report Card', label: 'Academic Report', sub: true },
            { id: 'AFL Report Card', label: 'AFL Report', sub: true }
          ]
        },
        {
          category: 'System & Admin',
          items: [
            { id: 'Analytics', label: 'Analytics' },
            { id: 'Branding', label: 'Branding' },
            { id: 'Settings', label: 'Settings' },
            { id: 'Backup', label: 'Backup' }
          ]
        }
      ]
    : currentRole === 'teacher'
    ? [
        {
          items: [{ id: 'Dashboard', label: 'Dashboard' }]
        },
        {
          category: 'Classroom & CBT',
          items: [
            { id: 'CA Score Entry', label: 'CA Score Entry' },
            { id: 'My Classes', label: 'My Classes' },
            { id: 'Question Bank', label: 'Question Bank' },
            { id: 'Exams', label: 'Exams' },
            { id: 'Live Exam', label: 'Live Exam' },
            { id: 'Results', label: 'Results' },
            { id: 'Attendance', label: 'Attendance' }
          ]
        },
        {
          category: 'Reports & Assessments',
          items: [
            { id: 'Reports Hub', label: 'Reports Hub' },
            { id: 'CA 1 Report Card', label: 'CA 1 Report Card', sub: true },
            { id: 'CA 2 Report Card', label: 'CA 2 Report Card', sub: true },
            { id: 'Combined CA Report', label: 'Combined CA Report', sub: true },
            { id: 'Academic Report Card', label: 'Academic Report', sub: true },
            { id: 'AFL Report Card', label: 'AFL Report', sub: true }
          ]
        },
        {
          category: 'Overview',
          items: [
            { id: 'Analytics', label: 'Analytics' }
          ]
        }
      ]
    : [
        {
          items: [{ id: 'Dashboard', label: 'Dashboard' }]
        },
        {
          category: 'Student Portal',
          items: [
            { id: 'My Exams', label: 'My Exams' },
            { id: 'My Results', label: 'My Results' },
            { id: 'My Analytics', label: 'My Analytics' }
          ]
        },
        {
          category: 'Reports & Assessments',
          items: [
            { id: 'Reports Hub', label: 'Reports Hub' },
            { id: 'CA 1 Report Card', label: 'CA 1 Report Card', sub: true },
            { id: 'CA 2 Report Card', label: 'CA 2 Report Card', sub: true },
            { id: 'Combined CA Report', label: 'Combined CA Report', sub: true },
            { id: 'Academic Report Card', label: 'Academic Report', sub: true },
            { id: 'AFL Report Card', label: 'AFL Report', sub: true }
          ]
        }
      ];
    
  const [activeTab, setActiveTab] = useState('Dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'Dashboard': return <DashboardHome />;
      case 'Students': return <AdminStudents />;
      case 'Teachers': return <AdminTeachers />;
      case 'Subjects': return currentRole === 'admin' ? <SubjectsList /> : null;
      case 'CA Score Entry': return currentRole !== 'student' ? <TeacherCAScoreEntry /> : null;
      case 'CA 1 Report':
      case 'CA 1 Report Card': return <CAReportCardView initialType="CA1" />;
      case 'CA 2 Report':
      case 'CA 2 Report Card': return <CAReportCardView initialType="CA2" />;
      case 'Combined CA Report': return <CAReportCardView initialType="Combined" />;
      case 'Academic Report':
      case 'Academic Report Card': return <ReportsView initialCategory="academic" />;
      case 'AFL Report':
      case 'AFL Report Card': return <ReportsView initialCategory="afl" />;
      case 'Question Bank': return currentRole !== 'student' ? <QuestionBankView /> : null;
      case 'Exams': return currentRole !== 'student' ? <ExamsManager /> : null;
      case 'Live Exam': return currentRole !== 'student' ? <LiveExamMonitoring /> : null;
      case 'Results': return <ResultsView studentOnly={false} />;
      case 'My Results': return <ResultsView studentOnly={true} />;
      case 'Reports':
      case 'Reports Hub': return <ReportsView initialCategory="academic" />;
      case 'Analytics':
      case 'My Analytics':
        return <AnalyticsView />;
      case 'Branding': return <BrandingForm />;
      case 'Settings': return <SettingsForm />;
      case 'Backup': return <BackupRestore />;
      case 'My Exams': return <MyExams />;
      case 'Attendance': return <AttendanceView />;
      case 'My Classes': return <MyClassesView />;
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
        <div className="flex flex-col gap-2 flex-1">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="flex flex-col gap-0.5">
              {group.category && (
                <div className="text-[10px] font-black uppercase tracking-wider text-white/55 px-2.5 pt-2.5 pb-1 select-none">
                  {group.category}
                </div>
              )}
              {group.items.map(item => {
                const isActive = activeTab === item.id;
                return (
                  <div 
                    key={item.id}
                    className={`rounded-[9px] cursor-pointer transition-all flex items-center ${
                      item.sub 
                        ? 'p-[8px_12px_8px_20px] text-xs' 
                        : 'p-[10px_12px] text-sm font-medium'
                    } ${isActive ? 'text-slate-900 font-bold' : 'hover:text-slate-900'}`}
                    style={{ backgroundColor: isActive ? branding.secondary : 'transparent' }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = branding.secondary;
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    onClick={() => setActiveTab(item.id)}
                  >
                    {item.sub && <span className="opacity-50 mr-2 text-[10px]">└</span>}
                    <span className="truncate">{item.label}</span>
                  </div>
                );
              })}
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
        useStore.setState({ currentUser: { ...t } });
        const sid = useStore.getState().schoolId;
        if (sid) {
          localStorage.setItem(`educore_current_user_${sid}`, JSON.stringify(t));
        } else {
          localStorage.setItem('educore_current_user', JSON.stringify(t));
        }
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
          useStore.setState({ currentUser: { ...t } });
          const sid = useStore.getState().schoolId;
          if (sid) {
            localStorage.setItem(`educore_current_user_${sid}`, JSON.stringify(t));
          } else {
            localStorage.setItem('educore_current_user', JSON.stringify(t));
          }
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

