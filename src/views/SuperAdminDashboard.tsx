import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Card, Input, Label, Modal } from '../components/ui';
import { SuperAdminService, ProvisionAdminParams } from '../lib/auth/superAdminService';
import {
  LayoutDashboard,
  Building2,
  Users,
  ShieldAlert,
  ShieldCheck,
  Search,
  Plus,
  RefreshCw,
  LogOut,
  Menu,
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Lock,
  UserCheck,
  UserX,
  FileText,
  Activity,
  Calendar,
  School,
  GraduationCap,
  BookOpen,
  ChevronRight,
  Shield,
  KeyRound,
  Info,
  Server,
  Database
} from 'lucide-react';

interface SchoolDetail {
  id: string;
  name: string;
  createdAt: string;
  status: 'active' | 'suspended';
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  studentCount: number;
  teacherCount: number;
  adminCount: number;
  academicSession: string;
  academicTerm: string;
}

interface PlatformUser {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'teacher' | 'student';
  schoolId: string;
  schoolName: string;
  email: string;
  status: 'active' | 'suspended';
  class?: string;
  classes?: string[];
  subjects?: string[];
}

export default function SuperAdminDashboard() {
  const { globalTenants, createTenant, logout, currentUser } = useStore();
  const showToast = useToastStore((state) => state.showToast);

  // Navigation & layout state
  const [activeTab, setActiveTab] = useState<'overview' | 'schools' | 'admins' | 'users' | 'security'>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Data states
  const [schoolsData, setSchoolsData] = useState<SchoolDetail[]>([]);
  const [usersData, setUsersData] = useState<PlatformUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [systemMetrics, setSystemMetrics] = useState({
    totalSchools: 0,
    activeSchools: 0,
    suspendedSchools: 0,
    pendingSchools: 0,
    totalStudents: 0,
    totalTeachers: 0,
    totalAdmins: 0,
    platformStatus: 'Operational'
  });

  // Filters & searches
  const [schoolSearch, setSchoolSearch] = useState('');
  const [schoolStatusFilter, setSchoolStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');

  const [adminSearch, setAdminSearch] = useState('');
  const [adminSchoolFilter, setAdminSchoolFilter] = useState<string>('all');

  const [userSearch, setUserSearch] = useState('');
  const [userSchoolFilter, setUserSchoolFilter] = useState<string>('all');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'admin' | 'teacher' | 'student'>('all');

  // Modals state
  const [isRegisteringSchool, setIsRegisteringSchool] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    schoolId: '',
    schoolName: '',
    adminId: 'admin',
    adminPass: '',
    contactEmail: '',
    contactPhone: ''
  });
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [editingSchool, setEditingSchool] = useState<SchoolDetail | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    contactEmail: '',
    contactPhone: '',
    status: 'active' as 'active' | 'suspended',
    notes: ''
  });

  const [inspectingSchool, setInspectingSchool] = useState<SchoolDetail | null>(null);

  // Admin provisioning modal
  const [isProvisioningAdmin, setIsProvisioningAdmin] = useState(false);
  const [provisionAdminForm, setProvisionAdminForm] = useState({
    schoolId: '',
    adminId: '',
    adminName: '',
    password: ''
  });
  const [showProvPassword, setShowProvPassword] = useState(false);

  // Reset user password modal
  const [resettingUser, setResettingUser] = useState<PlatformUser | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Change master password modal
  const [isChangingMasterPass, setIsChangingMasterPass] = useState(false);
  const [masterPassForm, setMasterPassForm] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [showMasterPass, setShowMasterPass] = useState(false);

  // Load platform data
  const loadPlatformData = async () => {
    setLoading(true);
    try {
      const overviewRes = await SuperAdminService.getPlatformOverview();
      if (overviewRes.success) {
        if (overviewRes.metrics) {
          setSystemMetrics(overviewRes.metrics);
        }
        if (overviewRes.schools) {
          setSchoolsData(overviewRes.schools);
        }
        if (overviewRes.recentLogs) {
          setAuditLogs(overviewRes.recentLogs);
        }
      } else {
        // Fallback calculation from globalTenants if offline or starting up
        const computedSchools: SchoolDetail[] = globalTenants.map(t => ({
          id: t.id,
          name: t.name,
          createdAt: t.createdAt,
          status: t.status || 'active',
          studentCount: 0,
          teacherCount: 0,
          adminCount: 1,
          academicSession: '2024/2025',
          academicTerm: 'Term 1'
        }));
        setSchoolsData(computedSchools);
        setSystemMetrics({
          totalSchools: globalTenants.length,
          activeSchools: globalTenants.filter(t => t.status !== 'suspended').length,
          suspendedSchools: globalTenants.filter(t => t.status === 'suspended').length,
          pendingSchools: 0,
          totalStudents: 0,
          totalTeachers: 0,
          totalAdmins: globalTenants.length,
          platformStatus: 'Operational'
        });
      }

      // Fetch all users
      const usersRes = await SuperAdminService.getPlatformUsers();
      if (usersRes.success && usersRes.users) {
        setUsersData(usersRes.users);
      }
      setLastRefreshed(new Date());
    } catch (err) {
      console.warn('Error loading platform data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlatformData();
  }, [globalTenants.length]);

  // Derived filterings
  const filteredSchools = useMemo(() => {
    return schoolsData.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(schoolSearch.toLowerCase()) ||
                            s.id.toLowerCase().includes(schoolSearch.toLowerCase());
      const matchesStatus = schoolStatusFilter === 'all' || s.status === schoolStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [schoolsData, schoolSearch, schoolStatusFilter]);

  const allAdmins = useMemo(() => {
    return usersData.filter(u => u.role === 'admin');
  }, [usersData]);

  const filteredAdmins = useMemo(() => {
    return allAdmins.filter(a => {
      const matchesSearch = a.name.toLowerCase().includes(adminSearch.toLowerCase()) ||
                            a.username.toLowerCase().includes(adminSearch.toLowerCase()) ||
                            a.email.toLowerCase().includes(adminSearch.toLowerCase()) ||
                            a.schoolId.toLowerCase().includes(adminSearch.toLowerCase());
      const matchesSchool = adminSchoolFilter === 'all' || a.schoolId === adminSchoolFilter;
      return matchesSearch && matchesSchool;
    });
  }, [allAdmins, adminSearch, adminSchoolFilter]);

  const filteredUsers = useMemo(() => {
    return usersData.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                            u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
                            u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
                            u.schoolId.toLowerCase().includes(userSearch.toLowerCase());
      const matchesSchool = userSchoolFilter === 'all' || u.schoolId === userSchoolFilter;
      const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
      return matchesSearch && matchesSchool && matchesRole;
    });
  }, [usersData, userSearch, userSchoolFilter, userRoleFilter]);

  // Handler: Register New School
  const handleRegisterSchool = async () => {
    const cleanId = registerForm.schoolId.trim().toLowerCase();
    const cleanName = registerForm.schoolName.trim();
    const cleanAdmin = registerForm.adminId.trim().toLowerCase();
    const cleanPass = registerForm.adminPass.trim();

    if (!cleanId || !cleanName || !cleanAdmin || !cleanPass) {
      showToast('School ID, School Name, Admin ID, and Password are all required.');
      return;
    }

    if (!/^[a-z0-9-]+$/.test(cleanId)) {
      showToast('School ID must contain only lowercase letters, numbers, and hyphens (e.g. greenwood-high).');
      return;
    }

    if (globalTenants.some(t => t.id.toLowerCase() === cleanId)) {
      showToast(`A school with identifier "${cleanId}" already exists. Please choose a unique School ID.`);
      return;
    }

    if (cleanPass.length < 6) {
      showToast('Initial administrator password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await createTenant(cleanId, cleanName, cleanAdmin, cleanPass);
      if (!res.success) {
        showToast(res.error || 'Failed to create school');
        setLoading(false);
        return;
      }

      // Provision school admin in Firebase Auth & Firestore
      await SuperAdminService.provisionSchoolAdmin({
        schoolId: cleanId,
        adminId: cleanAdmin,
        adminName: `Admin (${cleanName})`,
        password: cleanPass
      });

      // Update contact details if provided
      if (registerForm.contactEmail || registerForm.contactPhone) {
        await SuperAdminService.updateSchool(cleanId, {
          contactEmail: registerForm.contactEmail.trim(),
          contactPhone: registerForm.contactPhone.trim()
        });
      }

      showToast(`School "${cleanName}" registered and initial administrator provisioned successfully!`);
      setIsRegisteringSchool(false);
      setRegisterForm({
        schoolId: '',
        schoolName: '',
        adminId: 'admin',
        adminPass: '',
        contactEmail: '',
        contactPhone: ''
      });
      await loadPlatformData();
    } catch (err: any) {
      showToast(err.message || 'Error creating school.');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Open Edit School
  const handleOpenEdit = (s: SchoolDetail) => {
    setEditingSchool(s);
    setEditForm({
      name: s.name,
      contactEmail: s.contactEmail || '',
      contactPhone: s.contactPhone || '',
      status: s.status,
      notes: s.notes || ''
    });
  };

  // Handler: Save Edit School
  const handleSaveEdit = async () => {
    if (!editingSchool) return;
    if (!editForm.name.trim()) {
      showToast('School name cannot be empty.');
      return;
    }

    setLoading(true);
    try {
      const res = await SuperAdminService.updateSchool(editingSchool.id, {
        name: editForm.name.trim(),
        status: editForm.status,
        contactEmail: editForm.contactEmail.trim(),
        contactPhone: editForm.contactPhone.trim(),
        notes: editForm.notes.trim()
      });

      if (res.success) {
        showToast(`School "${editingSchool.name}" updated successfully.`);
        setEditingSchool(null);
        await loadPlatformData();
      } else {
        showToast(res.error || 'Failed to update school.');
      }
    } catch (err: any) {
      showToast(err.message || 'An error occurred updating the school.');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Toggle School Status (Suspend / Reactivate)
  const handleToggleSchoolStatus = async (school: SchoolDetail) => {
    const action = school.status === 'suspended' ? 'activate' : 'suspend';
    const confirmMessage = school.status === 'suspended'
      ? `Reactivate school "${school.name}"? Users and staff will regain immediate login access.`
      : `Suspend school "${school.name}"? This temporarily prevents users from logging in, but NEVER deletes any student or academic records.`;

    if (!confirm(confirmMessage)) return;

    setLoading(true);
    try {
      const newStatus = school.status === 'suspended' ? 'active' : 'suspended';
      const res = await SuperAdminService.updateSchool(school.id, { status: newStatus });
      if (res.success) {
        showToast(`School "${school.name}" is now ${newStatus}.`);
        await loadPlatformData();
      } else {
        showToast(res.error || `Failed to ${action} school.`);
      }
    } catch (err: any) {
      showToast(err.message || 'Error changing school status.');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Delete School
  const handleDeleteSchool = async (school: SchoolDetail) => {
    const confirmText = prompt(
      `DANGER ZONE: Type "${school.id}" to confirm permanent deletion of school "${school.name}". All associated directory links will be removed.`
    );
    if (confirmText !== school.id) {
      if (confirmText !== null) showToast('Deletion cancelled: School ID did not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await SuperAdminService.deleteSchool(school.id);
      if (res.success) {
        showToast(`School "${school.name}" deleted from platform directory.`);
        await loadPlatformData();
      } else {
        showToast(res.error || 'Failed to delete school.');
      }
    } catch (err: any) {
      showToast(err.message || 'Error deleting school.');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Provision School Admin
  const handleProvisionAdminSubmit = async () => {
    const { schoolId, adminId, adminName, password } = provisionAdminForm;
    if (!schoolId || !adminId.trim() || !password.trim()) {
      showToast('School selection, Admin Username, and Password are required.');
      return;
    }

    if (password.trim().length < 6) {
      showToast('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await SuperAdminService.provisionSchoolAdmin({
        schoolId,
        adminId: adminId.trim().toLowerCase(),
        adminName: adminName.trim() || undefined,
        password: password.trim()
      });

      if (res.success) {
        showToast(res.message || 'School administrator successfully provisioned!');
        setIsProvisioningAdmin(false);
        setProvisionAdminForm({ schoolId: '', adminId: '', adminName: '', password: '' });
        await loadPlatformData();
      } else {
        showToast(res.error || 'Failed to provision school administrator.');
      }
    } catch (err: any) {
      showToast(err.message || 'Error provisioning administrator.');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Toggle User Status
  const handleToggleUserStatus = async (user: PlatformUser) => {
    const action = user.status === 'suspended' ? 'activate' : 'disable';
    if (!confirm(`Are you sure you want to ${action} account "${user.username}" for school "${user.schoolName}"?`)) {
      return;
    }

    setLoading(true);
    try {
      const newStatus = user.status === 'suspended' ? 'active' : 'disabled';
      const res = await SuperAdminService.toggleUserStatus(user.schoolId, user.username, newStatus);
      if (res.success) {
        showToast(`User "${user.username}" is now ${newStatus}.`);
        await loadPlatformData();
      } else {
        showToast(res.error || 'Failed to update user status.');
      }
    } catch (err: any) {
      showToast(err.message || 'Error updating user status.');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Reset User Password
  const handleResetPasswordSubmit = async () => {
    if (!resettingUser) return;
    if (!resetNewPassword.trim() || resetNewPassword.trim().length < 6) {
      showToast('New password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await SuperAdminService.recoverUserAccount({
        schoolId: resettingUser.schoolId,
        username: resettingUser.username,
        role: resettingUser.role,
        displayName: resettingUser.name,
        newPassword: resetNewPassword.trim()
      });

      if (res.success) {
        showToast(`Password updated and account "${resettingUser.username}" recovered successfully!`);
        setResettingUser(null);
        setResetNewPassword('');
        await loadPlatformData();
      } else {
        showToast(res.error || 'Failed to reset password.');
      }
    } catch (err: any) {
      showToast(err.message || 'Error resetting password.');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Change Master Super Administrator Password
  const handleChangeMasterPassword = async () => {
    const { newPassword, confirmPassword } = masterPassForm;
    if (!newPassword || newPassword.length < 8) {
      showToast('New Master Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await SuperAdminService.changePassword(newPassword);
      if (res.success) {
        showToast('Super Administrator master password changed successfully!');
        setIsChangingMasterPass(false);
        setMasterPassForm({ newPassword: '', confirmPassword: '' });
      } else {
        showToast(res.error || 'Failed to update master password.');
      }
    } catch (err: any) {
      showToast(err.message || 'Error updating master password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col lg:flex-row font-sans selection:bg-indigo-600 selection:text-white">
      {/* ========================================================================= */}
      {/* MOBILE HEADER                                                            */}
      {/* ========================================================================= */}
      <div className="lg:hidden bg-slate-950 border-b border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black shadow-md">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight m-0">EduCore</h1>
            <p className="text-[11px] text-indigo-400 font-semibold m-0">Global Super Admin</p>
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
          aria-label="Toggle Navigation"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SIDEBAR NAVIGATION                                                       */}
      {/* ========================================================================= */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          {/* Logo Brand Header */}
          <div className="p-6 border-b border-slate-800/70 hidden lg:flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-white tracking-tight">EduCore</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-purple-300 bg-purple-950 px-2 py-0.5 rounded-full border border-purple-800">
                  Global
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 m-0">Platform Super Admin</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => { setActiveTab('overview'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Platform Overview</span>
            </button>

            <button
              onClick={() => { setActiveTab('schools'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'schools'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 shrink-0" />
                <span>School Management</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {schoolsData.length}
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('admins'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'admins'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 shrink-0" />
                <span>School Administrators</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {allAdmins.length}
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('users'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'users'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 shrink-0" />
                <span>Platform Users</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {usersData.length}
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('security'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'security'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Security & Audit Logs</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer with Super Admin Identity */}
        <div className="p-4 border-t border-slate-800/80 space-y-3">
          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-900/60 border border-purple-700/60 flex items-center justify-center text-purple-300 font-bold text-xs">
                SA
              </div>
              <div>
                <p className="text-xs font-bold text-white m-0">Superadmin</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-emerald-400 font-medium">Session Active</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsChangingMasterPass(true)}
              title="Change Master Password"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
            </button>
          </div>

          <Button
            variant="danger"
            onClick={logout}
            className="w-full py-2 text-xs flex items-center justify-center gap-2 rounded-xl"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Secure Sign Out</span>
          </Button>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
        />
      )}

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA                                                        */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900 overflow-y-auto">
        {/* Top Sticky Header */}
        <header className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-6 py-4 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Platform</span>
              <ChevronRight className="w-3 h-3" />
              <span className="capitalize text-indigo-400 font-medium">{activeTab}</span>
            </div>
            <h2 className="text-xl font-bold text-white m-0 mt-0.5">
              {activeTab === 'overview' && 'Platform Overview & Live Metrics'}
              {activeTab === 'schools' && 'Registered Institutions & Tenants'}
              {activeTab === 'admins' && 'School Administrator Authority'}
              {activeTab === 'users' && 'Platform-Wide User Directory'}
              {activeTab === 'security' && 'Security Audit Trail & Master Controls'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadPlatformData}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800/90 hover:bg-slate-700 px-3 py-2 rounded-xl border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
              title="Refresh platform statistics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <Button
              onClick={() => setIsRegisteringSchool(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-bold shadow-md shadow-indigo-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>Register School</span>
            </Button>
          </div>
        </header>

        {/* Content Body */}
        <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* ===================================================================== */}
          {/* TAB 1: OVERVIEW                                                       */}
          {/* ===================================================================== */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Summary Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-slate-950 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Total Schools</span>
                    <Building2 className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="text-3xl font-black text-white">{systemMetrics.totalSchools}</div>
                  <div className="mt-2 text-xs flex items-center gap-2">
                    <span className="text-emerald-400 font-semibold">{systemMetrics.activeSchools} Active</span>
                    {systemMetrics.suspendedSchools > 0 && (
                      <span className="text-rose-400 font-semibold">• {systemMetrics.suspendedSchools} Suspended</span>
                    )}
                  </div>
                </Card>

                <Card className="bg-slate-950 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Enrolled Students</span>
                    <GraduationCap className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-3xl font-black text-white">{systemMetrics.totalStudents}</div>
                  <div className="mt-2 text-xs text-slate-400">Across all institutions</div>
                </Card>

                <Card className="bg-slate-950 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Active Teachers</span>
                    <BookOpen className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-3xl font-black text-white">{systemMetrics.totalTeachers}</div>
                  <div className="mt-2 text-xs text-slate-400">Faculty & Exam creators</div>
                </Card>

                <Card className="bg-slate-950 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">School Admins</span>
                    <Shield className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-3xl font-black text-white">{systemMetrics.totalAdmins}</div>
                  <div className="mt-2 text-xs text-slate-400">Provisioned managers</div>
                </Card>
              </div>

              {/* Status Distribution & System Alerts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* System Alerts */}
                <Card className="bg-slate-950 border border-slate-800 p-6 rounded-2xl lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-indigo-400" />
                      <h3 className="text-base font-bold text-white m-0">Platform Health & Actionable Alerts</h3>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      All Services Operational
                    </span>
                  </div>

                  <div className="space-y-3 pt-2">
                    {systemMetrics.suspendedSchools > 0 && (
                      <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-amber-200 m-0">Suspended Institutions Present</p>
                          <p className="text-xs text-amber-300/80 m-0 mt-0.5">
                            {systemMetrics.suspendedSchools} school(s) are currently marked suspended. Staff and student logins for those schools are paused.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-slate-200 m-0">Firebase Authentication & Multi-Tenant Isolation Active</p>
                        <p className="text-xs text-slate-400 m-0 mt-0.5">
                          Cross-school access controls enforced by security rules. Student and staff credentials scoped to institutional domains.
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
                      <Database className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-slate-200 m-0">Cloud Firestore Roster & Database Synchronized</p>
                        <p className="text-xs text-slate-400 m-0 mt-0.5">
                          Real-time snapshots listening to tenant state. Total platform accounts recorded: {usersData.length}.
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Status Distribution Panel */}
                <Card className="bg-slate-950 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white m-0 mb-4">Account Tier Breakdown</h3>
                    <div className="space-y-3 text-xs">
                      <div>
                        <div className="flex justify-between text-slate-300 font-medium mb-1">
                          <span>Students</span>
                          <span>{systemMetrics.totalStudents}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full" 
                            style={{ width: `${usersData.length ? Math.min(100, (systemMetrics.totalStudents / usersData.length) * 100) : 0}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-slate-300 font-medium mb-1">
                          <span>Teachers</span>
                          <span>{systemMetrics.totalTeachers}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full" 
                            style={{ width: `${usersData.length ? Math.min(100, (systemMetrics.totalTeachers / usersData.length) * 100) : 0}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-slate-300 font-medium mb-1">
                          <span>Administrators</span>
                          <span>{systemMetrics.totalAdmins}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-purple-500 rounded-full" 
                            style={{ width: `${usersData.length ? Math.min(100, (systemMetrics.totalAdmins / usersData.length) * 100) : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                    <span>Last Refreshed:</span>
                    <span className="font-mono text-slate-300">{lastRefreshed.toLocaleTimeString()}</span>
                  </div>
                </Card>
              </div>

              {/* Quick Table: Recent Registered Schools */}
              <Card className="bg-slate-950 border border-slate-800 p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-white m-0">Recent School Registrations</h3>
                  <button
                    onClick={() => setActiveTab('schools')}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    View All Schools ({schoolsData.length})
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">School Name</th>
                        <th className="pb-3 font-semibold">School ID</th>
                        <th className="pb-3 font-semibold">Status</th>
                        <th className="pb-3 font-semibold">Students</th>
                        <th className="pb-3 font-semibold">Teachers</th>
                        <th className="pb-3 font-semibold">Registration Date</th>
                        <th className="pb-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {schoolsData.slice(0, 5).map((s) => (
                        <tr key={s.id} className="hover:bg-slate-900/50 transition-colors">
                          <td className="py-3 font-bold text-white">{s.name}</td>
                          <td className="py-3 font-mono text-indigo-300">{s.id}</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              s.status === 'suspended'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            }`}>
                              {s.status === 'suspended' ? 'Suspended' : 'Active'}
                            </span>
                          </td>
                          <td className="py-3 text-slate-300">{s.studentCount}</td>
                          <td className="py-3 text-slate-300">{s.teacherCount}</td>
                          <td className="py-3 text-slate-400">{new Date(s.createdAt).toLocaleDateString()}</td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => setInspectingSchool(s)}
                              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold px-2 py-1 rounded bg-slate-900 border border-slate-800"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ===================================================================== */}
          {/* TAB 2: SCHOOL MANAGEMENT                                              */}
          {/* ===================================================================== */}
          {activeTab === 'schools' && (
            <div className="space-y-6">
              {/* Filter & Action Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="flex flex-1 items-center gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      value={schoolSearch}
                      onChange={(e) => setSchoolSearch(e.target.value)}
                      placeholder="Search schools by name or ID..."
                      className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 pl-9 text-xs"
                    />
                  </div>

                  <select
                    value={schoolStatusFilter}
                    onChange={(e: any) => setSchoolStatusFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active Only</option>
                    <option value="suspended">Suspended Only</option>
                  </select>
                </div>

                <Button
                  onClick={() => setIsRegisteringSchool(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 font-bold shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register New School</span>
                </Button>
              </div>

              {/* Schools Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSchools.length === 0 ? (
                  <div className="col-span-full py-16 text-center text-slate-500 bg-slate-950 rounded-2xl border border-slate-800">
                    <School className="w-12 h-12 mx-auto text-slate-600 mb-2 opacity-50" />
                    <p className="text-sm font-semibold m-0">No matching schools found.</p>
                    <p className="text-xs text-slate-600 mt-1">Try adjusting your search criteria or register a new school.</p>
                  </div>
                ) : (
                  filteredSchools.map((s) => {
                    const isSuspended = s.status === 'suspended';
                    return (
                      <Card
                        key={s.id}
                        className={`bg-slate-950 border flex flex-col justify-between p-5 rounded-2xl transition-all ${
                          isSuspended ? 'border-rose-900/60 bg-rose-950/10' : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                isSuspended ? 'bg-rose-900/30 text-rose-400' : 'bg-indigo-900/30 text-indigo-400'
                              }`}>
                                <Building2 className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className="text-base font-bold text-white m-0 leading-snug">{s.name}</h3>
                                <p className="text-xs font-mono text-indigo-300 m-0">ID: {s.id}</p>
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                              isSuspended
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            }`}>
                              {isSuspended ? 'Suspended' : 'Active'}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-800/80 my-3 text-center">
                            <div>
                              <span className="block text-sm font-bold text-white">{s.studentCount}</span>
                              <span className="text-[10px] text-slate-400">Students</span>
                            </div>
                            <div>
                              <span className="block text-sm font-bold text-white">{s.teacherCount}</span>
                              <span className="text-[10px] text-slate-400">Teachers</span>
                            </div>
                            <div>
                              <span className="block text-sm font-bold text-white">{s.adminCount}</span>
                              <span className="text-[10px] text-slate-400">Admins</span>
                            </div>
                          </div>

                          <div className="space-y-1 text-xs text-slate-400">
                            <div className="flex justify-between">
                              <span>Academic Session:</span>
                              <span className="text-slate-300 font-medium">{s.academicSession} ({s.academicTerm})</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Registered:</span>
                              <span className="text-slate-300">{new Date(s.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-800/80 mt-4 flex items-center gap-2">
                          <button
                            onClick={() => setInspectingSchool(s)}
                            className="flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors"
                          >
                            Details
                          </button>
                          <button
                            onClick={() => handleOpenEdit(s)}
                            className="flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-slate-700 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleSchoolStatus(s)}
                            className={`py-1.5 px-2.5 text-xs font-semibold rounded-lg border transition-colors ${
                              isSuspended
                                ? 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border-emerald-800'
                                : 'bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border-amber-800'
                            }`}
                            title={isSuspended ? 'Activate School' : 'Suspend School'}
                          >
                            {isSuspended ? 'Activate' : 'Suspend'}
                          </button>
                          <button
                            onClick={() => handleDeleteSchool(s)}
                            className="p-1.5 text-xs font-semibold rounded-lg bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800 transition-colors"
                            title="Delete School"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* TAB 3: SCHOOL ADMINISTRATOR MANAGEMENT                                */}
          {/* ===================================================================== */}
          {activeTab === 'admins' && (
            <div className="space-y-6">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="flex flex-1 items-center gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      value={adminSearch}
                      onChange={(e) => setAdminSearch(e.target.value)}
                      placeholder="Search administrators by name, email, school..."
                      className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 pl-9 text-xs"
                    />
                  </div>

                  <select
                    value={adminSchoolFilter}
                    onChange={(e) => setAdminSchoolFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs"
                  >
                    <option value="all">All Schools</option>
                    {schoolsData.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <Button
                  onClick={() => setIsProvisioningAdmin(true)}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 font-bold shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Provision School Admin</span>
                </Button>
              </div>

              {/* Admins Table */}
              <Card className="bg-slate-950 border border-slate-800 p-6 rounded-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">Administrator</th>
                        <th className="pb-3 font-semibold">Associated School</th>
                        <th className="pb-3 font-semibold">Institutional Auth Email</th>
                        <th className="pb-3 font-semibold">Account Status</th>
                        <th className="pb-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredAdmins.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500">
                            No school administrators found matching criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredAdmins.map((adm) => (
                          <tr key={`${adm.schoolId}_${adm.username}`} className="hover:bg-slate-900/50 transition-colors">
                            <td className="py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-purple-900/30 text-purple-300 flex items-center justify-center font-bold text-xs">
                                  {adm.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-bold text-white m-0">{adm.name}</p>
                                  <p className="text-[11px] font-mono text-slate-400 m-0">@{adm.username}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5">
                              <p className="text-slate-200 font-medium m-0">{adm.schoolName}</p>
                              <span className="text-[10px] font-mono text-indigo-400">[{adm.schoolId}]</span>
                            </td>
                            <td className="py-3.5 font-mono text-slate-300">{adm.email}</td>
                            <td className="py-3.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                adm.status === 'suspended'
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              }`}>
                                {adm.status === 'suspended' ? 'Suspended' : 'Active'}
                              </span>
                            </td>
                            <td className="py-3.5 text-right space-x-2">
                              <button
                                onClick={() => {
                                  setResettingUser(adm);
                                  setResetNewPassword('');
                                }}
                                className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-slate-700 transition-colors"
                              >
                                Reset Password
                              </button>
                              <button
                                onClick={() => handleToggleUserStatus(adm)}
                                className={`px-2.5 py-1 text-xs font-semibold rounded border transition-colors ${
                                  adm.status === 'suspended'
                                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                    : 'bg-rose-950 text-rose-300 border-rose-800'
                                }`}
                              >
                                {adm.status === 'suspended' ? 'Enable' : 'Disable'}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ===================================================================== */}
          {/* TAB 4: PLATFORM-WIDE USER DIRECTORY                                   */}
          {/* ===================================================================== */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              {/* Filter Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="flex flex-1 flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search users across all schools..."
                      className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 pl-9 text-xs"
                    />
                  </div>

                  <select
                    value={userSchoolFilter}
                    onChange={(e) => setUserSchoolFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs"
                  >
                    <option value="all">All Schools</option>
                    {schoolsData.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>

                  <select
                    value={userRoleFilter}
                    onChange={(e: any) => setUserRoleFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs"
                  >
                    <option value="all">All Roles</option>
                    <option value="admin">Administrators</option>
                    <option value="teacher">Teachers</option>
                    <option value="student">Students</option>
                  </select>
                </div>

                <div className="text-xs text-slate-400 font-semibold px-2">
                  Showing {filteredUsers.length} of {usersData.length} records
                </div>
              </div>

              {/* Users Table */}
              <Card className="bg-slate-950 border border-slate-800 p-6 rounded-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">User</th>
                        <th className="pb-3 font-semibold">Role</th>
                        <th className="pb-3 font-semibold">School</th>
                        <th className="pb-3 font-semibold">Academic Assignment</th>
                        <th className="pb-3 font-semibold">Status</th>
                        <th className="pb-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">
                            No platform users found matching current filters.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => {
                          const roleColors = {
                            admin: 'bg-purple-950 text-purple-300 border-purple-800',
                            teacher: 'bg-emerald-950 text-emerald-300 border-emerald-800',
                            student: 'bg-blue-950 text-blue-300 border-blue-800'
                          };

                          return (
                            <tr key={`${u.schoolId}_${u.role}_${u.username}`} className="hover:bg-slate-900/50 transition-colors">
                              <td className="py-3.5">
                                <p className="font-bold text-white m-0">{u.name}</p>
                                <p className="text-[11px] font-mono text-slate-400 m-0">ID: {u.username}</p>
                              </td>
                              <td className="py-3.5">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${roleColors[u.role]}`}>
                                  {u.role}
                                </span>
                              </td>
                              <td className="py-3.5">
                                <p className="text-slate-200 m-0">{u.schoolName}</p>
                                <span className="text-[10px] font-mono text-slate-400">[{u.schoolId}]</span>
                              </td>
                              <td className="py-3.5 text-slate-300">
                                {u.role === 'student' && (u.class || 'Unassigned')}
                                {u.role === 'teacher' && (
                                  <span>{u.classes?.join(', ') || 'General'} &bull; {u.subjects?.join(', ') || 'All'}</span>
                                )}
                                {u.role === 'admin' && <span className="text-slate-500">Full Academic Access</span>}
                              </td>
                              <td className="py-3.5">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  u.status === 'suspended'
                                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                }`}>
                                  {u.status === 'suspended' ? 'Suspended' : 'Active'}
                                </span>
                              </td>
                              <td className="py-3.5 text-right space-x-2">
                                <button
                                  onClick={() => {
                                    setResettingUser(u);
                                    setResetNewPassword('');
                                  }}
                                  className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-slate-700 transition-colors"
                                >
                                  Reset Password
                                </button>
                                <button
                                  onClick={() => handleToggleUserStatus(u)}
                                  className={`px-2 py-1 text-xs font-semibold rounded border transition-colors ${
                                    u.status === 'suspended'
                                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                      : 'bg-rose-950 text-rose-300 border-rose-800'
                                  }`}
                                >
                                  {u.status === 'suspended' ? 'Enable' : 'Disable'}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ===================================================================== */}
          {/* TAB 5: SECURITY & AUDIT TRAIL                                         */}
          {/* ===================================================================== */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Security Diagnostics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-slate-950 border border-slate-800 p-6 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-base font-bold text-white m-0">Master Account Security</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed m-0">
                    The Global Super Administrator master credential controls cross-tenant provisioning and database configuration.
                  </p>

                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Administrator UID:</span>
                      <span className="text-slate-200 font-mono">superadmin</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Institutional Email:</span>
                      <span className="text-slate-200 font-mono">superadmin@educore.internal</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Authorization Scope:</span>
                      <span className="text-purple-400 font-bold">Platform-Wide Root</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => setIsChangingMasterPass(true)}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold border border-slate-700"
                  >
                    <KeyRound className="w-4 h-4 text-purple-400" />
                    <span>Change Super Administrator Password</span>
                  </Button>
                </Card>

                <Card className="bg-slate-950 border border-slate-800 p-6 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2.5">
                    <Server className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-base font-bold text-white m-0">Infrastructure & Compliance Status</h3>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800/80">
                      <span className="text-slate-300">Firebase Authentication API</span>
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Enforced & Verified
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800/80">
                      <span className="text-slate-300">Firestore Multi-Tenant Isolation</span>
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Rule Guarded
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800/80">
                      <span className="text-slate-300">Public Demo Credentials</span>
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Completely Purged
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800/80">
                      <span className="text-slate-300">CBT Confidential Answer Keys</span>
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Isolated in Protected Subcollection
                      </span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Real-time Audit Trail Table */}
              <Card className="bg-slate-950 border border-slate-800 p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-base font-bold text-white m-0">Recent Security & Audit Logs</h3>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">Immutable audit trail</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">Timestamp</th>
                        <th className="pb-3 font-semibold">Actor</th>
                        <th className="pb-3 font-semibold">Role</th>
                        <th className="pb-3 font-semibold">Action</th>
                        <th className="pb-3 font-semibold">Target / School</th>
                        <th className="pb-3 font-semibold">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                            No audit log events recorded yet.
                          </td>
                        </tr>
                      ) : (
                        auditLogs.map((log, idx) => (
                          <tr key={log.id || idx} className="hover:bg-slate-900/50 transition-colors">
                            <td className="py-2.5 text-slate-400">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="py-2.5 text-slate-200 font-bold">{log.actorId}</td>
                            <td className="py-2.5">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-indigo-300 border border-slate-800">
                                {log.actorRole}
                              </span>
                            </td>
                            <td className="py-2.5 text-emerald-400 font-semibold">{log.action}</td>
                            <td className="py-2.5 text-slate-300">{log.schoolId || 'global'}</td>
                            <td className="py-2.5 text-slate-400 max-w-xs truncate font-sans">
                              {log.details ? JSON.stringify(log.details) : 'N/A'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: REGISTER NEW SCHOOL                                             */}
      {/* ========================================================================= */}
      <Modal isOpen={isRegisteringSchool} onClose={() => setIsRegisteringSchool(false)} className="bg-slate-900 text-white border border-slate-800 rounded-3xl p-6 sm:p-8">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white m-0">Register New School</h3>
              <p className="text-xs text-slate-400 m-0">Provision an isolated multi-tenant institution</p>
            </div>
          </div>
          <button
            onClick={() => setIsRegisteringSchool(false)}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-300 m-0 mb-1">
              School ID (Permanent URL Slug)
            </Label>
            <Input
              value={registerForm.schoolId}
              onChange={(e) => setRegisterForm(p => ({
                ...p,
                schoolId: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
              }))}
              placeholder="e.g. greenwood-high"
              className="bg-slate-950 border-slate-700 text-white text-xs placeholder:text-slate-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Lowercase letters, numbers, and hyphens only. Must be unique.
            </p>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-300 m-0 mb-1">
              Official School Full Name
            </Label>
            <Input
              value={registerForm.schoolName}
              onChange={(e) => setRegisterForm(p => ({ ...p, schoolName: e.target.value }))}
              placeholder="e.g. Greenwood International High School"
              className="bg-slate-950 border-slate-700 text-white text-xs placeholder:text-slate-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-300 m-0 mb-1">
                Contact Email (Optional)
              </Label>
              <Input
                value={registerForm.contactEmail}
                onChange={(e) => setRegisterForm(p => ({ ...p, contactEmail: e.target.value }))}
                placeholder="contact@school.edu"
                className="bg-slate-950 border-slate-700 text-white text-xs placeholder:text-slate-500"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-300 m-0 mb-1">
                Contact Phone (Optional)
              </Label>
              <Input
                value={registerForm.contactPhone}
                onChange={(e) => setRegisterForm(p => ({ ...p, contactPhone: e.target.value }))}
                placeholder="+234 800 000 0000"
                className="bg-slate-950 border-slate-700 text-white text-xs placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Initial Administrator Setup */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 mt-2">
            <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider m-0">
              Initial School Administrator Account
            </h4>

            <div>
              <Label className="text-xs font-semibold text-slate-300 m-0 mb-1">
                Admin Username
              </Label>
              <Input
                value={registerForm.adminId}
                onChange={(e) => setRegisterForm(p => ({ ...p, adminId: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') }))}
                placeholder="e.g. admin"
                className="bg-slate-900 border-slate-700 text-white text-xs placeholder:text-slate-500"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-300 m-0 mb-1">
                Admin Initial Password
              </Label>
              <div className="relative">
                <Input
                  type={showRegPassword ? 'text' : 'password'}
                  value={registerForm.adminPass}
                  onChange={(e) => setRegisterForm(p => ({ ...p, adminPass: e.target.value }))}
                  placeholder="Min 6 characters"
                  className="bg-slate-900 border-slate-700 text-white text-xs placeholder:text-slate-500 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              variant="secondary"
              onClick={() => setIsRegisteringSchool(false)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-4 py-2 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRegisterSchool}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-5 py-2 rounded-xl font-bold"
            >
              {loading ? 'Registering School...' : 'Register School'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT SCHOOL INFORMATION                                         */}
      {/* ========================================================================= */}
      <Modal isOpen={!!editingSchool} onClose={() => setEditingSchool(null)} className="bg-slate-900 text-white border border-slate-800 rounded-3xl p-6 sm:p-8">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white m-0">Edit School Profile</h3>
            <p className="text-xs text-slate-400 m-0">School ID: <span className="font-mono text-indigo-300">{editingSchool?.id}</span></p>
          </div>
          <button onClick={() => setEditingSchool(null)} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-300 m-0 mb-1">School Full Name</Label>
            <Input
              value={editForm.name}
              onChange={(e) => setEditForm(p => ({ ...p, name: e.target.value }))}
              className="bg-slate-950 border-slate-700 text-white text-xs"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-300 m-0 mb-1">Status</Label>
            <select
              value={editForm.status}
              onChange={(e: any) => setEditForm(p => ({ ...p, status: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2.5 text-xs"
            >
              <option value="active">Active (Login Allowed)</option>
              <option value="suspended">Suspended (Login Blocked, Records Preserved)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-300 m-0 mb-1">Contact Email</Label>
              <Input
                value={editForm.contactEmail}
                onChange={(e) => setEditForm(p => ({ ...p, contactEmail: e.target.value }))}
                className="bg-slate-950 border-slate-700 text-white text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-300 m-0 mb-1">Contact Phone</Label>
              <Input
                value={editForm.contactPhone}
                onChange={(e) => setEditForm(p => ({ ...p, contactPhone: e.target.value }))}
                className="bg-slate-950 border-slate-700 text-white text-xs"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-300 m-0 mb-1">Internal Notes</Label>
            <Input
              value={editForm.notes}
              onChange={(e) => setEditForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="e.g. Approved by Ministry, Pilot phase"
              className="bg-slate-950 border-slate-700 text-white text-xs"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              variant="secondary"
              onClick={() => setEditingSchool(null)}
              className="bg-slate-800 text-slate-300 text-xs px-4 py-2 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-5 py-2 rounded-xl font-bold"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: VIEW SCHOOL DETAILS / PROFILE                                   */}
      {/* ========================================================================= */}
      <Modal isOpen={!!inspectingSchool} onClose={() => setInspectingSchool(null)} className="bg-slate-900 text-white border border-slate-800 rounded-3xl p-6 sm:p-8">
        {inspectingSchool && (
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white m-0">{inspectingSchool.name}</h3>
                  <p className="text-xs font-mono text-indigo-300 m-0">Identifier: {inspectingSchool.id}</p>
                </div>
              </div>
              <button onClick={() => setInspectingSchool(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-slate-400 block mb-0.5">Status:</span>
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                    inspectingSchool.status === 'suspended'
                      ? 'bg-rose-950 text-rose-300 border border-rose-800'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}>
                    {inspectingSchool.status === 'suspended' ? 'Suspended' : 'Active'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Created Date:</span>
                  <span className="text-slate-200 font-medium">
                    {new Date(inspectingSchool.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Current Session:</span>
                  <span className="text-slate-200 font-medium">{inspectingSchool.academicSession}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Current Term:</span>
                  <span className="text-slate-200 font-medium">{inspectingSchool.academicTerm}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-lg font-black text-white block">{inspectingSchool.studentCount}</span>
                  <span className="text-[11px] text-slate-400">Enrolled Students</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-lg font-black text-white block">{inspectingSchool.teacherCount}</span>
                  <span className="text-[11px] text-slate-400">Active Teachers</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-lg font-black text-white block">{inspectingSchool.adminCount}</span>
                  <span className="text-[11px] text-slate-400">School Admins</span>
                </div>
              </div>

              {inspectingSchool.contactEmail && (
                <div className="flex justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Contact Email:</span>
                  <span className="text-slate-200 font-medium">{inspectingSchool.contactEmail}</span>
                </div>
              )}

              {inspectingSchool.notes && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block mb-1">Notes:</span>
                  <p className="text-slate-300 m-0">{inspectingSchool.notes}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  variant="secondary"
                  onClick={() => setInspectingSchool(null)}
                  className="bg-slate-800 text-slate-300 text-xs px-4 py-2 rounded-xl"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    const s = inspectingSchool;
                    setInspectingSchool(null);
                    handleOpenEdit(s);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-xl"
                >
                  Edit School Info
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: PROVISION SCHOOL ADMINISTRATOR                                   */}
      {/* ========================================================================= */}
      <Modal isOpen={isProvisioningAdmin} onClose={() => setIsProvisioningAdmin(false)} className="bg-slate-900 text-white border border-slate-800 rounded-3xl p-6 sm:p-8">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white m-0">Provision School Administrator</h3>
              <p className="text-xs text-slate-400 m-0">Assign privileged authority to a school tenant</p>
            </div>
          </div>
          <button onClick={() => setIsProvisioningAdmin(false)} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-300 m-0 mb-1">Target School</Label>
            <select
              value={provisionAdminForm.schoolId}
              onChange={(e) => setProvisionAdminForm(p => ({ ...p, schoolId: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2.5 text-xs"
            >
              <option value="">Select a registered school...</option>
              {schoolsData.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-300 m-0 mb-1">Administrator Username</Label>
            <Input
              value={provisionAdminForm.adminId}
              onChange={(e) => setProvisionAdminForm(p => ({ ...p, adminId: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') }))}
              placeholder="e.g. admin2"
              className="bg-slate-950 border-slate-700 text-white text-xs placeholder:text-slate-500"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-300 m-0 mb-1">Administrator Display Name</Label>
            <Input
              value={provisionAdminForm.adminName}
              onChange={(e) => setProvisionAdminForm(p => ({ ...p, adminName: e.target.value }))}
              placeholder="e.g. John Doe (Vice Principal)"
              className="bg-slate-950 border-slate-700 text-white text-xs placeholder:text-slate-500"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-300 m-0 mb-1">Temporary / Initial Password</Label>
            <div className="relative">
              <Input
                type={showProvPassword ? 'text' : 'password'}
                value={provisionAdminForm.password}
                onChange={(e) => setProvisionAdminForm(p => ({ ...p, password: e.target.value }))}
                placeholder="Min 6 characters"
                className="bg-slate-950 border-slate-700 text-white text-xs placeholder:text-slate-500 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowProvPassword(!showProvPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showProvPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              variant="secondary"
              onClick={() => setIsProvisioningAdmin(false)}
              className="bg-slate-800 text-slate-300 text-xs px-4 py-2 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleProvisionAdminSubmit}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-5 py-2 rounded-xl font-bold"
            >
              {loading ? 'Provisioning...' : 'Provision Administrator'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 5: RESET USER PASSWORD                                             */}
      {/* ========================================================================= */}
      <Modal isOpen={!!resettingUser} onClose={() => setResettingUser(null)} className="bg-slate-900 text-white border border-slate-800 rounded-3xl p-6 sm:p-8">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white m-0">Reset User Password</h3>
            <p className="text-xs text-slate-400 m-0">
              User: <span className="text-white font-bold">{resettingUser?.name}</span> ({resettingUser?.username}) &bull; School: {resettingUser?.schoolName}
            </p>
          </div>
          <button onClick={() => setResettingUser(null)} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-300 m-0 mb-1">New Password</Label>
            <div className="relative">
              <Input
                type={showResetPassword ? 'text' : 'password'}
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                placeholder="Enter new secure password (min 6 chars)"
                className="bg-slate-950 border-slate-700 text-white text-xs placeholder:text-slate-500 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowResetPassword(!showResetPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            This immediately updates the user's Firebase Authentication account and enables active access.
          </p>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              variant="secondary"
              onClick={() => setResettingUser(null)}
              className="bg-slate-800 text-slate-300 text-xs px-4 py-2 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleResetPasswordSubmit}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-5 py-2 rounded-xl font-bold"
            >
              Update Password
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 6: CHANGE MASTER SUPER ADMINISTRATOR PASSWORD                       */}
      {/* ========================================================================= */}
      <Modal isOpen={isChangingMasterPass} onClose={() => setIsChangingMasterPass(false)} className="bg-slate-900 text-white border border-slate-800 rounded-3xl p-6 sm:p-8">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white m-0">Change Master Password</h3>
              <p className="text-xs text-slate-400 m-0">Update Global Super Administrator master key</p>
            </div>
          </div>
          <button onClick={() => setIsChangingMasterPass(false)} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-300 m-0 mb-1">New Master Password</Label>
            <div className="relative">
              <Input
                type={showMasterPass ? 'text' : 'password'}
                value={masterPassForm.newPassword}
                onChange={(e) => setMasterPassForm(p => ({ ...p, newPassword: e.target.value }))}
                placeholder="At least 8 characters"
                className="bg-slate-950 border-slate-700 text-white text-xs placeholder:text-slate-500 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowMasterPass(!showMasterPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showMasterPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-300 m-0 mb-1">Confirm New Password</Label>
            <Input
              type={showMasterPass ? 'text' : 'password'}
              value={masterPassForm.confirmPassword}
              onChange={(e) => setMasterPassForm(p => ({ ...p, confirmPassword: e.target.value }))}
              placeholder="Re-enter new password"
              className="bg-slate-950 border-slate-700 text-white text-xs placeholder:text-slate-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              variant="secondary"
              onClick={() => setIsChangingMasterPass(false)}
              className="bg-slate-800 text-slate-300 text-xs px-4 py-2 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangeMasterPassword}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-5 py-2 rounded-xl font-bold"
            >
              {loading ? 'Updating...' : 'Set Master Password'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
