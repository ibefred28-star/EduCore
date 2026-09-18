import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Role } from '../types';
import { Button, Card, Input, Label, Select } from '../components/ui';

export default function Login() {
  const { branding, login, schoolId, setSchoolId, loginSuperAdmin } = useStore();
  const showToast = useToastStore((state) => state.showToast);
  
  const [role, setRole] = useState<Role | 'superadmin'>('student');
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  
  const [tempSchoolId, setTempSchoolId] = useState('');

  // Handle super admin login directly from the dropdown
  const handleLogin = () => {
    if (role === 'superadmin') {
      if (loginSuperAdmin(password)) {
        showToast('Welcome, Super Administrator');
      } else {
        showToast('Invalid super admin password');
      }
      return;
    }
    
    // Normal login
    const res = login(role as Role, id, password);
    if (res.success) {
      showToast('Login successful');
    } else {
      showToast(res.error || 'Invalid credentials');
    }
  };

  const handleSetSchool = () => {
    if (!tempSchoolId.trim()) return showToast('Please enter a valid School ID');
    setSchoolId(tempSchoolId.trim().toLowerCase());
  };

  // State 1: No school selected, and not trying to login as superadmin
  if (!schoolId && role !== 'superadmin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-5 relative">
        <Card className="w-full max-w-sm text-center py-10">
          <h2 className="text-2xl font-bold mt-0 mb-6">Welcome to EduCore</h2>
          
          <div className="text-left mb-6">
            <Label>I am a...</Label>
            <Select value={role} onChange={e => setRole(e.target.value as any)}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">School Administrator</option>
              <option value="superadmin">Global Super Admin</option>
            </Select>
          </div>

          <div className="text-left">
            <Label>School ID</Label>
            <Input 
              value={tempSchoolId} 
              onChange={e => setTempSchoolId(e.target.value)} 
              placeholder="e.g. greenwood" 
              onKeyDown={e => e.key === 'Enter' && handleSetSchool()}
            />
            <Button className="w-full mt-4" onClick={handleSetSchool}>Continue to School Portal</Button>
          </div>
        </Card>
      </div>
    );
  }

  // State 2: Super Admin login (bypasses school ID)
  if (role === 'superadmin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 p-5 relative">
        <Card className="w-full max-w-sm text-center py-10 border-slate-700 shadow-2xl">
          <h2 className="text-2xl font-bold mt-0 mb-6 text-slate-800">Super Admin Portal</h2>
          
          <div className="text-left mb-4">
            <Label>Login Type</Label>
            <Select value={role} onChange={e => setRole(e.target.value as any)}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">School Administrator</option>
              <option value="superadmin">Global Super Admin</option>
            </Select>
          </div>

          <div className="text-left">
            <Label>Master Password</Label>
            <Input 
              type="password"
              value={password} 
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="admin123"
            />
            <Button className="w-full mt-6" onClick={handleLogin}>Access Global Portal</Button>
          </div>
        </Card>
      </div>
    );
  }

  // State 3: School selected, showing branded portal
  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      <section 
        className="text-white flex items-center justify-center text-center p-10 min-h-[260px] relative"
        style={{ background: `linear-gradient(135deg, ${branding.primary}, ${branding.secondary})` }}
      >
        <button 
          onClick={() => setSchoolId(null)}
          className="absolute top-4 left-4 bg-black/20 hover:bg-black/40 px-3 py-1 rounded text-sm transition-colors"
        >
          ← Change School
        </button>
        <div>
          {branding.logo && (
            <img 
              src={branding.logo} 
              alt="Logo" 
              className="w-[90px] h-[90px] object-cover rounded-full bg-white mb-[15px] mx-auto"
            />
          )}
          <h1 className="text-4xl font-bold m-0">{branding.schoolName}</h1>
          <p className="text-xl mt-2">{branding.motto}</p>
        </div>
      </section>
      
      <section className="flex items-center justify-center p-5 bg-slate-50">
        <div className="w-full max-w-[430px]">
          <Card>
            <h2 className="text-2xl font-bold mt-0">Sign in</h2>
            
            <Label>Role</Label>
            <Select value={role} onChange={e => setRole(e.target.value as any)}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">School Administrator</option>
              <option value="superadmin">Global Super Admin</option>
            </Select>
            
            <Label>Username / ID</Label>
            <Input 
              value={id} 
              onChange={e => setId(e.target.value)} 
              placeholder={role === 'student' ? 'e.g. STU001' : role === 'teacher' ? 'e.g. teacher1' : 'e.g. admin'} 
            />
            
            <Label>Password</Label>
            <Input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="Enter password" 
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
            
            <Button className="w-full mt-5" onClick={handleLogin}>
              Login
            </Button>

            <div className="mt-5 pt-4 border-t border-slate-100 text-xs text-slate-500">
              <span className="font-semibold block text-slate-600 mb-2">Quick Demo Accounts:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => { setRole('student'); setId('STU001'); setPassword('pass'); }}
                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                >
                  Student (Aisha Bello: STU001)
                </button>
                <button
                  type="button"
                  onClick={() => { setRole('teacher'); setId('teacher1'); setPassword('pass'); }}
                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                >
                  Teacher (Mr. Okafor: teacher1)
                </button>
                <button
                  type="button"
                  onClick={() => { setRole('admin'); setId('admin'); setPassword('admin'); }}
                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                >
                  Admin (admin)
                </button>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
