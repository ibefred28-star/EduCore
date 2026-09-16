import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Role } from '../types';
import { Button, Card, Input, Label, Select, Modal } from '../components/ui';

export default function Login() {
  const { branding, login, schoolId, setSchoolId, loginSuperAdmin } = useStore();
  const showToast = useToastStore((state) => state.showToast);
  
  const [role, setRole] = useState<Role>('student');
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  
  const [tempSchoolId, setTempSchoolId] = useState('');
  const [showSuperAdmin, setShowSuperAdmin] = useState(false);
  const [superAdminPass, setSuperAdminPass] = useState('');

  // When schoolId becomes set, ensure UI updates (done by Zustand)

  const handleSetSchool = () => {
    if (!tempSchoolId.trim()) return showToast('Please enter a valid School ID');
    setSchoolId(tempSchoolId.trim().toLowerCase());
  };

  const handleSuperAdminLogin = () => {
    if (loginSuperAdmin(superAdminPass)) {
      showToast('Welcome, Super Administrator');
      setShowSuperAdmin(false);
    } else {
      showToast('Invalid super admin password');
    }
  };

  const handleLogin = () => {
    if (login(role, id, password)) {
      showToast('Login successful');
    } else {
      showToast('Invalid credentials');
    }
  };

  if (!schoolId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-5 relative">
        <Card className="w-full max-w-sm text-center py-10">
          <h2 className="text-2xl font-bold mt-0 mb-2">Welcome to EduCore</h2>
          <p className="text-slate-500 mb-6">Please enter your School ID to continue.</p>
          <Input 
            value={tempSchoolId} 
            onChange={e => setTempSchoolId(e.target.value)} 
            placeholder="e.g. greenwood" 
            onKeyDown={e => e.key === 'Enter' && handleSetSchool()}
            className="text-center font-bold"
          />
          <Button className="w-full mt-4" onClick={handleSetSchool}>Continue</Button>
        </Card>

        <button 
          onClick={() => setShowSuperAdmin(true)}
          className="absolute bottom-6 text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          Super Admin Portal
        </button>

        <Modal isOpen={showSuperAdmin} onClose={() => setShowSuperAdmin(false)}>
          <h2 className="text-xl font-bold mt-0 mb-4">Super Admin Portal</h2>
          <Label>Master Password</Label>
          <Input 
            type="password"
            value={superAdminPass} 
            onChange={e => setSuperAdminPass(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSuperAdminLogin()}
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => setShowSuperAdmin(false)}>Cancel</Button>
            <Button onClick={handleSuperAdminLogin}>Login</Button>
          </div>
        </Modal>
      </div>
    );
  }

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
            <Select value={role} onChange={e => setRole(e.target.value as Role)}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Administrator</option>
            </Select>
            
            <Label>Username / ID</Label>
            <Input 
              value={id} 
              onChange={e => setId(e.target.value)} 
              placeholder="Enter your ID" 
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
          </Card>
        </div>
      </section>
    </div>
  );
}
