import React, { useState } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Card, Input, Label, Modal } from '../components/ui';

export default function AdminStudents() {
  const { data, updateData } = useStore();
  const showToast = useToastStore(s => s.showToast);
  
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({ id: '', name: '', class: 'JSS1', password: '', photo: '' });

  const openForm = (id?: string) => {
    if (id) {
      const s = data.students.find(x => x.id === id);
      if (s) setFormData({ id: s.id, name: s.name, class: s.class, password: s.password || '', photo: s.photo || '' });
    } else {
      setFormData({ id: 'STU' + Date.now(), name: '', class: 'JSS1', password: 'pass', photo: '' });
    }
    setEditingId(id || null);
    setIsOpen(true);
  };

  const saveStudent = () => {
    if (!formData.id || !formData.name) return showToast('ID and Name required');
    
    updateData(draft => {
      if (editingId) {
        const i = draft.students.findIndex(x => x.id === editingId);
        if (i >= 0) draft.students[i] = { ...draft.students[i], ...formData };
      } else {
        if (draft.students.some(s => s.id === formData.id)) {
          showToast('ID exists');
          return;
        }
        draft.students.push(formData);
      }
    });
    showToast('Student saved');
    setIsOpen(false);
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const r = new FileReader();
      r.onload = () => setFormData(prev => ({ ...prev, photo: r.result as string }));
      r.readAsDataURL(file);
    }
  };

  return (
    <>
      <div className="flex gap-2 flex-wrap mb-4">
        <Button onClick={() => openForm()}>Add Student</Button>
      </div>
      
      <div className="overflow-x-auto bg-white rounded-lg shadow border border-slate-200">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left">
              <th className="p-3 font-semibold">ID</th>
              <th className="p-3 font-semibold">Name</th>
              <th className="p-3 font-semibold">Class</th>
              <th className="p-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.students.map(s => (
              <tr key={s.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                <td className="p-3">{s.id}</td>
                <td className="p-3">{s.name}</td>
                <td className="p-3">{s.class}</td>
                <td className="p-3">
                  <Button variant="secondary" onClick={() => openForm(s.id)}>Edit</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <h2 className="text-xl font-bold mt-0">{editingId ? 'Edit' : 'Add'} Student</h2>
        
        <Label>ID</Label>
        <Input value={formData.id} onChange={e => setFormData(p => ({ ...p, id: e.target.value }))} readOnly={!!editingId} />
        
        <Label>Name</Label>
        <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
        
        <Label>Class</Label>
        <Input value={formData.class} onChange={e => setFormData(p => ({ ...p, class: e.target.value }))} />
        
        <Label>Password</Label>
        <Input value={formData.password} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} />
        
        <Label>Photo</Label>
        <Input type="file" accept="image/*" onChange={handlePhoto} />
        
        <div className="flex gap-2 mt-5">
          <Button onClick={saveStudent}>Save</Button>
          <Button variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
        </div>
      </Modal>
    </>
  );
}
