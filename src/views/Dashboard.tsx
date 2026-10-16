import React, { useState } from 'react';
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
import GradingDiagnosticView from './GradingDiagnosticView';
import LearningResourcesManager from './LearningResourcesManager';
import StudentLearningResources from './StudentLearningResources';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  BookOpenCheck,
  Calculator,
  FileQuestion,
  FileSpreadsheet,
  Radio,
  Award,
  CalendarCheck,
  Layers,
  Files,
  FileCheck,
  FileCheck2,
  FolderCheck,
  Sparkles,
  BarChart3,
  Palette,
  Settings,
  Database,
  Clock,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  User,
  ChevronRight,
  ChevronDown,
  School,
  Wrench
} from 'lucide-react';

interface NavItemDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  sub?: boolean;
  badge?: string;
  badgeColor?: string;
}

interface NavCategoryDef {
  category?: string;
  items: NavItemDef[];
}

export default function Dashboard() {
  const { branding, currentUser, currentRole, logout, data } = useStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  
  const teacher = currentRole === 'teacher' 
    ? data.teachers.find(t => (t.id || '').trim().toLowerCase() === (currentUser?.id || '').trim().toLowerCase()) || (currentUser as any)
    : null;
  const teacherClasses = teacher?.classes || [];

  const navGroups: NavCategoryDef[] = currentRole === 'admin' 
    ? [
        {
          items: [{ id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard }]
        },
        {
          category: 'Academics & CBT',
          items: [
            { id: 'Students', label: 'Students', icon: Users },
            { id: 'Teachers', label: 'Teachers', icon: GraduationCap },
            { id: 'Subjects', label: 'Subjects', icon: BookOpen },
            { id: 'CA Score Entry', label: 'CA Score Entry', icon: Calculator },
            { id: 'Question Bank', label: 'Question Bank', icon: FileQuestion },
            { id: 'Exams', label: 'Exams', icon: FileSpreadsheet },
            { id: 'Live Exam', label: 'Live Exam', icon: Radio, badge: 'Live', badgeColor: 'bg-rose-500' },
            { id: 'Results', label: 'Results', icon: Award },
            { id: 'Grading Diagnostics', label: 'Grading Diagnostics', icon: Wrench, badge: 'Tool', badgeColor: 'bg-indigo-600' },
            { id: 'Learning Resources', label: 'Learning Resources', icon: BookOpenCheck, badge: 'Audio', badgeColor: 'bg-emerald-600' },
            { id: 'Attendance', label: 'Attendance', icon: CalendarCheck }
          ]
        },
        {
          category: 'Reports & Assessments',
          items: [
            { id: 'Reports Hub', label: 'Reports Hub', icon: Files },
            { id: 'CA 1 Report Card', label: 'CA 1 Report Card', icon: FileCheck, sub: true, badge: '20' },
            { id: 'CA 2 Report Card', label: 'CA 2 Report Card', icon: FileCheck2, sub: true, badge: '20' },
            { id: 'Combined CA Report', label: 'Combined CA Report', icon: FolderCheck, sub: true, badge: '40' },
            { id: 'Academic Report Card', label: 'Academic Report', icon: GraduationCap, sub: true },
            { id: 'AFL Report Card', label: 'AFL Report', icon: Sparkles, sub: true }
          ]
        },
        {
          category: 'System & Admin',
          items: [
            { id: 'Analytics', label: 'Analytics', icon: BarChart3 },
            { id: 'Branding', label: 'Branding', icon: Palette },
            { id: 'Settings', label: 'Settings', icon: Settings },
            { id: 'Backup', label: 'Backup & Data', icon: Database }
          ]
        }
      ]
    : currentRole === 'teacher'
    ? [
        {
          items: [{ id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard }]
        },
        {
          category: 'Classroom & CBT',
          items: [
            { id: 'CA Score Entry', label: 'CA Score Entry', icon: Calculator },
            { id: 'My Classes', label: 'My Classes', icon: Layers },
            { id: 'Learning Resources', label: 'Learning Resources', icon: BookOpenCheck, badge: 'Audio', badgeColor: 'bg-emerald-600' },
            { id: 'Question Bank', label: 'Question Bank', icon: FileQuestion },
            { id: 'Exams', label: 'Exams', icon: FileSpreadsheet },
            { id: 'Live Exam', label: 'Live Exam', icon: Radio, badge: 'Live', badgeColor: 'bg-rose-500' },
            { id: 'Results', label: 'Results', icon: Award },
            { id: 'Grading Diagnostics', label: 'Grading Diagnostics', icon: Wrench, badge: 'Tool', badgeColor: 'bg-indigo-600' },
            { id: 'Attendance', label: 'Attendance', icon: CalendarCheck }
          ]
        },
        {
          category: 'Reports & Assessments',
          items: [
            { id: 'Reports Hub', label: 'Reports Hub', icon: Files },
            { id: 'CA 1 Report Card', label: 'CA 1 Report Card', icon: FileCheck, sub: true, badge: '20' },
            { id: 'CA 2 Report Card', label: 'CA 2 Report Card', icon: FileCheck2, sub: true, badge: '20' },
            { id: 'Combined CA Report', label: 'Combined CA Report', icon: FolderCheck, sub: true, badge: '40' },
            { id: 'Academic Report Card', label: 'Academic Report', icon: GraduationCap, sub: true },
            { id: 'AFL Report Card', label: 'AFL Report', icon: Sparkles, sub: true }
          ]
        },
        {
          category: 'Insights',
          items: [
            { id: 'Analytics', label: 'Analytics', icon: BarChart3 }
          ]
        }
      ]
    : [
        {
          items: [{ id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard }]
        },
        {
          category: 'Student Portal',
          items: [
            { id: 'My Learning Resources', label: 'My Learning Resources', icon: BookOpenCheck, badge: '🇬🇧 Audio', badgeColor: 'bg-rose-500' },
            { id: 'My Exams', label: 'My Exams', icon: Clock },
            { id: 'My Results', label: 'My Results', icon: Award },
            { id: 'My Analytics', label: 'My Analytics', icon: BarChart3 }
          ]
        }
      ];
    
  const [activeTab, setActiveTab] = useState('Dashboard');

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'Dashboard': return <DashboardHome />;
      case 'Students': return <AdminStudents />;
      case 'Teachers': return <AdminTeachers />;
      case 'Subjects': return currentRole === 'admin' ? <SubjectsList /> : null;
      case 'CA Score Entry': return currentRole !== 'student' ? <TeacherCAScoreEntry /> : null;
      case 'CA 1 Report':
      case 'CA 1 Report Card': return currentRole !== 'student' ? <CAReportCardView initialType="CA1" /> : null;
      case 'CA 2 Report':
      case 'CA 2 Report Card': return currentRole !== 'student' ? <CAReportCardView initialType="CA2" /> : null;
      case 'Combined CA Report': return currentRole !== 'student' ? <CAReportCardView initialType="Combined" /> : null;
      case 'Academic Report':
      case 'Academic Report Card': return currentRole !== 'student' ? <ReportsView initialCategory="academic" /> : null;
      case 'AFL Report':
      case 'AFL Report Card': return currentRole !== 'student' ? <ReportsView initialCategory="afl" /> : null;
      case 'Question Bank': return currentRole !== 'student' ? <QuestionBankView /> : null;
      case 'Exams': return currentRole !== 'student' ? <ExamsManager /> : null;
      case 'Live Exam': return currentRole !== 'student' ? <LiveExamMonitoring /> : null;
      case 'Results': return <ResultsView studentOnly={false} />;
      case 'My Results': return <ResultsView studentOnly={true} />;
      case 'Grading Diagnostics': return currentRole !== 'student' ? <GradingDiagnosticView /> : null;
      case 'Reports':
      case 'Reports Hub': return currentRole !== 'student' ? <ReportsView initialCategory="academic" /> : null;
      case 'Analytics':
      case 'My Analytics':
        return <AnalyticsView />;
      case 'Branding': return <BrandingForm />;
      case 'Settings': return <SettingsForm />;
      case 'Backup': return <BackupRestore />;
      case 'My Exams': return <MyExams />;
      case 'Attendance': return <AttendanceView />;
      case 'My Classes': return <MyClassesView />;
      case 'Learning Resources': return currentRole !== 'student' ? <LearningResourcesManager /> : null;
      case 'My Learning Resources': return <StudentLearningResources />;
      default: return null;
    }
  };

  const roleLabel = currentRole === 'admin' 
    ? 'School Administrator' 
    : currentRole === 'teacher' 
    ? 'Teacher Portal' 
    : 'Student Portal';

  const roleIcon = currentRole === 'admin' 
    ? ShieldCheck 
    : currentRole === 'teacher' 
    ? GraduationCap 
    : User;

  const RoleIconComp = roleIcon;

  return (
    <div className="min-h-screen bg-slate-100/60 text-slate-800 flex flex-col md:flex-row">
      {/* Mobile Top Navigation Bar */}
      <header 
        className="md:hidden flex items-center justify-between px-4 py-3 text-white sticky top-0 z-40 shadow-sm"
        style={{ backgroundColor: branding.primary }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {branding.logo ? (
            <img 
              src={branding.logo} 
              alt="Logo" 
              className="w-8 h-8 object-cover rounded-lg bg-white shrink-0 shadow-xs"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <School className="w-4 h-4 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-extrabold truncate leading-tight">{branding.schoolName || 'EduCore'}</div>
            <div className="text-[10px] text-white/70 truncate">{activeTab}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Redesigned Sidebar (Desktop Fixed + Mobile Drawer) */}
      <aside 
        className={`
          fixed top-0 bottom-0 left-0 z-50 md:z-30
          w-72 md:w-64 flex flex-col justify-between
          text-white shadow-xl md:shadow-md
          transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{ backgroundColor: branding.primary }}
      >
        {/* Sidebar Header & Brand Area */}
        <div className="p-4 pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            {branding.logo ? (
              <img 
                src={branding.logo} 
                alt="Logo" 
                className="w-10 h-10 object-cover rounded-xl bg-white shadow-xs shrink-0 ring-2 ring-white/20"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 shadow-xs">
                <School className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-base font-extrabold truncate text-white leading-tight">
                {branding.schoolName || 'EduCore'}
              </div>
              <div className="text-[11px] text-white/65 truncate font-medium">
                {branding.motto || 'School Assessment System'}
              </div>
            </div>
            {/* Mobile close button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Role Status Pill */}
          <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 border border-white/10 text-white/90 text-xs">
            <RoleIconComp className="w-3.5 h-3.5 text-white" />
            <span className="font-semibold truncate">{roleLabel}</span>
          </div>
        </div>

        {/* Navigation Categories & Items */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 scrollbar-thin scrollbar-thumb-white/20">
          {navGroups.map((group, gIdx) => {
            const isCollapsed = group.category ? Boolean(collapsedCategories[group.category]) : false;
            return (
              <div key={gIdx} className="space-y-1">
                {group.category && (
                  <button
                    type="button"
                    onClick={() => group.category && setCollapsedCategories(prev => ({ ...prev, [group.category!]: !prev[group.category!] }))}
                    className="w-full text-[11px] font-black uppercase tracking-wider text-white/70 hover:text-white px-2.5 pt-2 pb-1 select-none flex items-center justify-between cursor-pointer transition-colors group"
                  >
                    <span>{group.category}</span>
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 text-white/50 group-hover:text-white" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-white/50 group-hover:text-white" />
                    )}
                  </button>
                )}
                {(!group.category || !isCollapsed) && (
                  <div className="space-y-0.5">
                    {group.items.map(item => {
                      const isActive = activeTab === item.id;
                      const IconComponent = item.icon;
                      return (
                        <button 
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectTab(item.id)}
                          className={`
                            w-full rounded-xl cursor-pointer transition-all flex items-center justify-between text-left
                            ${item.sub 
                              ? 'py-2 pl-7 pr-3 text-xs' 
                              : 'py-2.5 px-3 text-xs font-semibold'
                            }
                            ${isActive 
                              ? 'font-bold shadow-xs' 
                              : 'text-white/85 hover:text-white hover:bg-white/10'
                            }
                          `}
                          style={{ 
                            backgroundColor: isActive ? branding.secondary : undefined,
                            color: isActive ? '#0f172a' : undefined
                          }}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {item.sub ? (
                              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-slate-900' : 'bg-white/50'}`} />
                            ) : (
                              <IconComponent className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-900' : 'text-white/80'}`} />
                            )}
                            <span className="truncate">{item.label}</span>
                          </div>

                          {/* Badge Indicator */}
                          {item.badge && (
                            <span className={`
                              text-[10px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0
                              ${item.badgeColor || (isActive ? 'bg-slate-900/20 text-slate-900' : 'bg-white/20 text-white')}
                            `}>
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* User Profile Card & Sign Out Footer */}
        <div className="p-3 border-t border-white/10 bg-black/10">
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/5 border border-white/10 mb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white text-slate-900 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                {(currentUser?.name || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate leading-tight">
                  {currentUser?.name || 'Authorized User'}
                </div>
                <div className="text-[10px] text-white/60 truncate font-mono">
                  {currentUser?.id || currentRole}
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors cursor-pointer border border-white/10"
          >
            <LogOut className="w-3.5 h-3.5 text-white/80" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
      
      {/* Main App Canvas */}
      <main className="md:ml-64 flex-1 p-4 md:p-6 min-w-0">
        <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-6 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span>{branding.schoolName || 'EduCore'}</span>
              <ChevronRight className="w-3 h-3 text-slate-400" />
              <span className="text-indigo-600 font-semibold">{roleLabel}</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5 m-0">{activeTab}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentRole === 'teacher' && teacherClasses.length > 0 && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 inline-flex items-center gap-1.5 shadow-xs">
                <Layers className="w-3.5 h-3.5" />
                Classes: {teacherClasses.join(', ')}
              </span>
            )}
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 shadow-xs">
              {currentUser?.name} ({currentUser?.id})
            </span>
          </div>
        </header>
        
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
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
            <div key={c} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
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
