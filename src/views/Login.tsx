import { useState } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Role } from '../types';
import { Button, Card, Input, Label, Select } from '../components/ui';

export default function Login() {
  const { branding, login } = useStore();
  const showToast = useToastStore((state) => state.showToast);
  
  const [role, setRole] = useState<Role>('student');
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (login(role, id, password)) {
      showToast('Login successful');
    } else {
      showToast('Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      <section 
        className="text-white flex items-center justify-center text-center p-10 min-h-[260px]"
        style={{ background: `linear-gradient(135deg, ${branding.primary}, ${branding.secondary})` }}
      >
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
      
      <section className="flex items-center justify-center p-5">
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
