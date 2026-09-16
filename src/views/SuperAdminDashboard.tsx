import { useState } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Card, Input, Label, Modal } from '../components/ui';

export default function SuperAdminDashboard() {
  const { globalTenants, createTenant, logout } = useStore();
  const showToast = useToastStore((state) => state.showToast);

  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    schoolId: '',
    schoolName: '',
    adminId: '',
    adminPass: ''
  });

  const handleCreate = async () => {
    if (!formData.schoolId || !formData.schoolName || !formData.adminId || !formData.adminPass) {
      showToast('All fields are required');
      return;
    }
    
    // Only letters, numbers, hyphens
    if (!/^[a-z0-9-]+$/.test(formData.schoolId.toLowerCase())) {
      showToast('School ID can only contain letters, numbers, and hyphens');
      return;
    }

    const success = await createTenant(
      formData.schoolId.toLowerCase(),
      formData.schoolName,
      formData.adminId,
      formData.adminPass
    );

    if (success) {
      showToast(`School ${formData.schoolName} created successfully!`);
      setIsCreating(false);
      setFormData({ schoolId: '', schoolName: '', adminId: '', adminPass: '' });
    } else {
      showToast('Failed to create school. ID might already exist.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white p-4 sticky top-0 z-10 shadow-md flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold m-0">EduCore Global Admin</h1>
          <p className="text-sm text-slate-400">Super Administrator Portal</p>
        </div>
        <Button variant="secondary" onClick={logout}>Sign Out</Button>
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold m-0">Registered Schools</h2>
          <Button onClick={() => setIsCreating(true)}>+ Add School</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {globalTenants.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500">
              No schools registered yet.
            </div>
          ) : (
            globalTenants.map((t) => (
              <Card key={t.id} className="flex flex-col h-full">
                <div className="mb-2">
                  <h3 className="text-lg font-bold m-0">{t.name}</h3>
                  <p className="text-sm text-slate-500 font-mono mt-1">ID: {t.id}</p>
                </div>
                <div className="mt-auto pt-4 border-t border-slate-100 text-sm text-slate-400">
                  Created: {new Date(t.createdAt).toLocaleDateString()}
                </div>
              </Card>
            ))
          )}
        </div>
      </main>

      <Modal isOpen={isCreating} onClose={() => setIsCreating(false)}>
        <h2 className="text-xl font-bold mt-0 mb-4">Register New School</h2>
        <div className="space-y-4">
          <div>
            <Label>School Login ID (URL safe)</Label>
            <Input 
              value={formData.schoolId}
              onChange={(e) => setFormData(p => ({ ...p, schoolId: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
              placeholder="e.g. greenwood-high"
            />
          </div>
          <div>
            <Label>School Full Name</Label>
            <Input 
              value={formData.schoolName}
              onChange={(e) => setFormData(p => ({ ...p, schoolName: e.target.value }))}
              placeholder="e.g. Greenwood High School"
            />
          </div>
          <div className="pt-4 border-t border-slate-200 mt-2">
            <h3 className="text-sm font-bold text-slate-700 mb-2">Initial Administrator</h3>
            <Label>Admin Username</Label>
            <Input 
              value={formData.adminId}
              onChange={(e) => setFormData(p => ({ ...p, adminId: e.target.value }))}
              placeholder="e.g. admin1"
            />
          </div>
          <div>
            <Label>Admin Password</Label>
            <Input 
              type="password"
              value={formData.adminPass}
              onChange={(e) => setFormData(p => ({ ...p, adminPass: e.target.value }))}
              placeholder="••••••••"
            />
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={() => setIsCreating(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create School</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
