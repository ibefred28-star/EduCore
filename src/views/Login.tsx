import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Role } from '../types';
import { Button, Card, Input, Label, Select } from '../components/ui';
import { 
  ShieldCheck, 
  School, 
  GraduationCap, 
  BookOpen, 
  ArrowLeft, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  AlertCircle
} from 'lucide-react';

import { TenantRepository } from '../lib/firestore/tenantRepository';

const LANDING_BG = '/landing-bg.jpg';
const FALLBACK_BG = 'https://gdb.voanews.com/6a3bfbea-3f94-4849-a377-c2cbfe59d61a_w1080_h608_s.jpg';
const LOGIN_PAGE_BG = 'https://s3.amazonaws.com/prod-hmhco-vmg-craftcms-public/_transforms/_large/WF1995913_Shaped_2024_Classcraft-blog_batch2_19.jpg';

export default function Login() {
  const { branding, login, schoolId, setSchoolId, loginSuperAdmin, globalTenants } = useStore();
  const showToast = useToastStore((state) => state.showToast);

  // Landing Page selection state
  const [selectedRole, setSelectedRole] = useState<'student' | 'teacher' | 'admin' | 'superadmin'>('student');
  const [landingSchoolId, setLandingSchoolId] = useState<string>('');
  const [isSuperAdminMode, setIsSuperAdminMode] = useState<boolean>(false);
  const [landingError, setLandingError] = useState<string | null>(null);
  const [isValidatingSchool, setIsValidatingSchool] = useState<boolean>(false);

  // Institution-Branded Login state
  const [activeRole, setActiveRole] = useState<Role>('student');
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Preload global tenants list on mount from Firestore so any device can resolve instantly
  useEffect(() => {
    TenantRepository.fetchAllTenants().then((list) => {
      if (list && list.length > 0) {
        useStore.setState({ globalTenants: list });
      }
    }).catch(console.warn);
  }, []);

  // Sync active role when role was chosen on landing page
  useEffect(() => {
    if (selectedRole !== 'superadmin') {
      setActiveRole(selectedRole);
    }
  }, [selectedRole]);

  // Handle image fallback if needed
  const [bgSrc, setBgSrc] = useState(LANDING_BG);

  // ---------------------------------------------------------------------------
  // PHASE 3 & 4: LANDING PAGE "CONTINUE" HANDLER
  // ---------------------------------------------------------------------------
  const handleLandingContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setLandingError(null);

    // 1. If Global Administrator, navigate to Master Admin Login
    if (selectedRole === 'superadmin') {
      setIsSuperAdminMode(true);
      return;
    }

    // 2. School ID Validation
    const rawInput = landingSchoolId.trim();
    if (!rawInput) {
      setLandingError('Please enter your School ID to continue.');
      return;
    }

    setIsValidatingSchool(true);

    try {
      const resolved = await TenantRepository.resolveSchoolTenant(rawInput);

      if (resolved.exists) {
        if (resolved.status === 'suspended') {
          setLandingError(resolved.error || 'This school account is currently suspended. Please contact platform administration.');
          setIsValidatingSchool(false);
          return;
        }

        // Apply resolved school branding if found
        if (resolved.branding) {
          useStore.setState({ branding: resolved.branding });
        }

        // Navigate to Institution-Branded Login Page
        setSchoolId(resolved.schoolId);
        setActiveRole(selectedRole as Role);
        setLandingError(null);
        setIsValidatingSchool(false);
        return;
      }

      setLandingError(resolved.error || 'School ID not found. Please verify the ID with your school administration (e.g. brightonhallschool or demo).');
    } catch (err: any) {
      console.warn('School validation check error:', err);
      // Fallback: If user entered demo or known school, still allow entry
      const clean = rawInput.toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (clean === 'demo' || clean.includes('brighton')) {
        setSchoolId(clean === 'demo' ? 'demo' : 'brightonhallschool');
        setActiveRole(selectedRole as Role);
        setLandingError(null);
      } else {
        setLandingError('Could not verify School ID. Please check with your school administration (e.g. brightonhallschool or demo).');
      }
    } finally {
      setIsValidatingSchool(false);
    }
  };

  // ---------------------------------------------------------------------------
  // INSTITUTION-BRANDED LOGIN SUBMIT
  // ---------------------------------------------------------------------------
  const handleInstitutionLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setLoginError(null);

    const cleanId = identifier.trim();
    const cleanPass = password.trim();

    if (!cleanId) {
      const field = activeRole === 'student' ? 'Admission / Student ID' : activeRole === 'teacher' ? 'Staff ID / Username' : 'Admin Username';
      setLoginError(`Please enter your ${field}.`);
      return;
    }

    if (!cleanPass) {
      setLoginError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login(activeRole, cleanId, cleanPass);
      if (res.success) {
        showToast('Login successful. Welcome back!');
      } else {
        setLoginError(res.error || 'Invalid credentials. Please verify your details.');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Authentication error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // GLOBAL SUPER ADMINISTRATOR LOGIN SUBMIT
  // ---------------------------------------------------------------------------
  const handleSuperAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setLoginError(null);

    if (!password.trim()) {
      setLoginError('Please enter your administrator password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await loginSuperAdmin(password.trim());
      if (res.success) {
        showToast('Welcome, Super Administrator');
      } else {
        setLoginError(res.error || 'Invalid administrator password.');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Authentication error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Return to public landing page from institution login or superadmin login
  const handleBackToLanding = () => {
    setSchoolId(null);
    setIsSuperAdminMode(false);
    setLoginError(null);
    setLandingError(null);
    setPassword('');
    setIdentifier('');
  };

  // ===========================================================================
  // VIEW 1: PUBLIC LANDING PAGE (Minimal & Elegant with Reference Image)
  // ===========================================================================
  if (!schoolId && !isSuperAdminMode) {
    return (
      <div className="min-h-screen relative flex flex-col justify-between font-sans selection:bg-indigo-600 selection:text-white overflow-hidden">
        {/* Exact Reference Background Image covering viewport */}
        <div
          className="absolute inset-0 bg-cover bg-center z-0 transition-opacity duration-300"
          style={{
            backgroundImage: `url(${bgSrc})`,
            backgroundPosition: 'center 35%'
          }}
        >
          {/* Hidden image element to detect load error and fallback */}
          <img
            src={bgSrc}
            alt=""
            className="hidden"
            onError={() => {
              if (bgSrc !== FALLBACK_BG) {
                setBgSrc(FALLBACK_BG);
              }
            }}
          />
        </div>

        {/* Subtle Dark Overlay to preserve visual character while ensuring readability */}
        <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[0.5px] z-10 pointer-events-none" />

        {/* Top Minimal Header */}
        <header className="relative z-20 w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center text-white font-black text-lg shadow-sm">
              E
            </div>
            <span className="text-xl font-black text-white tracking-tight drop-shadow-sm">
              EduCore
            </span>
          </div>
        </header>

        {/* Main Center Area: Compact, Refined Landing Form Container */}
        <main className="relative z-20 flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-sm">
            <div className="bg-slate-950/75 backdrop-blur-md border border-white/15 rounded-2xl p-6 sm:p-7 shadow-2xl text-white">
              {/* Header */}
              <div className="text-center mb-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300 block mb-1">
                  EduCore
                </span>
                <h1 className="text-2xl font-black text-white tracking-tight m-0">
                  Welcome to EduCore
                </h1>
                <p className="text-xs text-slate-300 mt-1 m-0">
                  Select your role to continue.
                </p>
              </div>

              {/* Error Message */}
              {landingError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{landingError}</span>
                </div>
              )}

              {/* Minimal Form: Role Selection + School ID + Continue Button */}
              <form onSubmit={handleLandingContinue} className="space-y-4">
                {/* 1. Role Selection */}
                <div>
                  <label htmlFor="landing-role-select" className="block text-xs font-semibold text-slate-200 mb-1">
                    Role
                  </label>
                  <select
                    id="landing-role-select"
                    value={selectedRole}
                    onChange={(e: any) => {
                      setSelectedRole(e.target.value);
                      setLandingError(null);
                    }}
                    className="w-full bg-slate-900/90 border border-white/20 text-white rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">School Administrator</option>
                    <option value="superadmin">Global Administrator</option>
                  </select>
                </div>

                {/* 2. School ID Field (Hidden for Global Administrator) */}
                {selectedRole !== 'superadmin' ? (
                  <div>
                    <label htmlFor="landing-school-id-input" className="block text-xs font-semibold text-slate-200 mb-1">
                      School ID
                    </label>
                    <input
                      id="landing-school-id-input"
                      type="text"
                      value={landingSchoolId}
                      onChange={(e) => {
                        setLandingSchoolId(e.target.value);
                        setLandingError(null);
                      }}
                      placeholder="e.g. brightonhallschool or demo"
                      className="w-full bg-slate-900/90 border border-white/20 text-white rounded-xl p-2.5 text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                    />
                    <p className="text-[10px] text-slate-300/90 mt-1.5 m-0 flex items-center justify-between">
                      <span>Enter your school ID (e.g. <strong className="text-white font-mono">brightonhallschool</strong> or <strong className="text-white font-mono">demo</strong>)</span>
                    </p>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-800/50 text-[11px] text-indigo-200 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>Master platform access. School ID is not required.</span>
                  </div>
                )}

                {/* Primary Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isValidatingSchool}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isValidatingSchool ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Verifying School ID...</span>
                      </>
                    ) : (
                      <span>Continue</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>

        {/* Minimal Footer */}
        <footer className="relative z-20 w-full max-w-6xl mx-auto px-6 py-4 text-center text-[11px] text-slate-300/80">
          <span>&copy; {new Date().getFullYear()} EduCore Platform. All rights reserved.</span>
        </footer>
      </div>
    );
  }

  // ===========================================================================
  // VIEW 2: GLOBAL SUPER ADMINISTRATOR LOGIN
  // ===========================================================================
  if (isSuperAdminMode && !schoolId) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-between font-sans selection:bg-purple-600 selection:text-white p-4">
        {/* Header */}
        <header className="w-full max-w-md mx-auto pt-6 flex items-center justify-between">
          <button
            onClick={handleBackToLanding}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to EduCore</span>
          </button>
        </header>

        {/* Center Container */}
        <main className="w-full max-w-md mx-auto my-auto">
          <Card className="bg-slate-900 border border-slate-800 p-7 rounded-2xl shadow-2xl text-white">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
              <div className="w-12 h-12 rounded-xl bg-purple-900/40 text-purple-300 border border-purple-700/60 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white m-0">Global Administrator</h2>
                <p className="text-xs text-slate-400 m-0">Master Platform Oversight</p>
              </div>
            </div>

            {loginError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleSuperAdminLogin} className="space-y-4">
              <div>
                <Label className="text-xs font-semibold text-slate-300 m-0 mb-1">
                  Administrator Identifier
                </Label>
                <Input
                  value="superadmin"
                  readOnly
                  disabled
                  className="bg-slate-950 border-slate-800 text-slate-400 font-mono text-xs cursor-not-allowed"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-300 m-0 mb-1">
                  Master Password
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter administrator password"
                    className="bg-slate-950 border-slate-700 text-white text-xs placeholder:text-slate-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 px-0.5">
                  <span>Default master key: <strong className="text-purple-300 font-mono">admin123</strong></span>
                  <button
                    type="button"
                    onClick={() => {
                      setPassword('admin123');
                      setLoginError(null);
                    }}
                    className="text-purple-400 hover:text-purple-200 underline cursor-pointer font-medium"
                  >
                    Use default password
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-xl text-xs shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>Verifying credentials...</span>
                    </>
                  ) : (
                    <span>Sign In to Global Dashboard</span>
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </main>

        <footer className="text-center text-[11px] text-slate-600 pb-4">
          <span>EduCore Multi-Tenant Infrastructure Security</span>
        </footer>
      </div>
    );
  }

  // ===========================================================================
  // VIEW 3: INSTITUTION-BRANDED LOGIN PAGE (Preserves School's Identity)
  // ===========================================================================
  return (
    <div className="min-h-screen relative flex flex-col justify-between font-sans selection:bg-indigo-600 selection:text-white p-4 overflow-hidden">
      {/* Background Image */}
      <div
        className="fixed inset-0 bg-cover bg-center z-0 transition-opacity duration-300"
        style={{
          backgroundImage: `url('${LOGIN_PAGE_BG}')`,
          backgroundPosition: 'center'
        }}
      />
      {/* Subtle overlay to preserve clean contrast while showcasing the background */}
      <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[1px] z-0 pointer-events-none" />

      {/* Top Header with "Change School" Navigation */}
      <header className="relative z-10 w-full max-w-md mx-auto pt-4 flex items-center justify-between">
        <button
          onClick={handleBackToLanding}
          className="inline-flex items-center gap-1.5 text-xs text-white/90 hover:text-white bg-slate-900/60 hover:bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 transition-all font-medium cursor-pointer shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Change School</span>
        </button>
        <span className="text-[11px] font-mono text-white/90 bg-slate-900/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/20 shadow-sm">
          ID: <strong>{schoolId}</strong>
        </span>
      </header>

      {/* Main Institution Card */}
      <main className="relative z-10 w-full max-w-md mx-auto my-auto py-4">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/40 p-7 sm:p-8">
          {/* Institution Crest, Name, and Branding */}
          <div className="text-center mb-6 pb-5 border-b border-slate-100">
            {branding.logo ? (
              <img
                src={branding.logo}
                alt={branding.schoolName}
                className="w-16 h-16 object-contain rounded-2xl mx-auto mb-3 shadow-md border border-slate-100 p-1 bg-white"
              />
            ) : (
              <div
                className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white font-black text-2xl shadow-md"
                style={{ backgroundColor: branding.primary || '#1e3a8a' }}
              >
                {branding.schoolName ? branding.schoolName.charAt(0).toUpperCase() : 'E'}
              </div>
            )}

            <h1 className="text-xl font-black text-slate-900 tracking-tight m-0">
              {branding.schoolName || 'EduCore School'}
            </h1>
            {branding.motto && (
              <p className="text-xs text-slate-500 mt-1 italic m-0">
                &ldquo;{branding.motto}&rdquo;
              </p>
            )}
          </div>

          {/* Role Tabs for the Institution */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-5">
            <button
              type="button"
              onClick={() => { setActiveRole('student'); setLoginError(null); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeRole === 'student'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Student
            </button>
            <button
              type="button"
              onClick={() => { setActiveRole('teacher'); setLoginError(null); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeRole === 'teacher'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Teacher
            </button>
            <button
              type="button"
              onClick={() => { setActiveRole('admin'); setLoginError(null); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeRole === 'admin'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Admin
            </button>
          </div>

          {/* Login Error Banner */}
          {loginError && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          {/* Sign In Form */}
          <form onSubmit={handleInstitutionLogin} className="space-y-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700 m-0 mb-1">
                {activeRole === 'student'
                  ? 'Student ID / Admission Number'
                  : activeRole === 'teacher'
                  ? 'Staff ID / Username'
                  : 'Administrator Username'}
              </Label>
              <div className="relative">
                <Input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={
                    activeRole === 'student'
                      ? 'e.g. STU001'
                      : activeRole === 'teacher'
                      ? 'e.g. teacher1'
                      : 'e.g. admin'
                  }
                  className="bg-white border-slate-300 text-slate-900 text-xs placeholder:text-slate-400 pl-9"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 m-0 mb-1">
                Password
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="bg-white border-slate-300 text-slate-900 text-xs placeholder:text-slate-400 pl-9 pr-10"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full text-white font-bold py-2.5 rounded-xl text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                style={{ backgroundColor: branding.primary || '#1e3a8a' }}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </Button>
            </div>
          </form>

          {/* School Help Note */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 m-0">
              Need assistance? Contact your school administrator.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center text-[11px] text-white/90 drop-shadow-sm font-medium pb-2">
        <span>Powered by EduCore Cloud</span>
      </footer>
    </div>
  );
}
