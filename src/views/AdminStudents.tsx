import React, { useState } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Input, Label, Modal, Select } from '../components/ui';
import { CLASS_OPTIONS } from '../constants';

export default function AdminStudents() {
  const { data, updateData } = useStore();
  const showToast = useToastStore(s => s.showToast);
  
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({ id: '', name: '', class: 'Primary 5', password: '', photo: '' });

  const openForm = (id?: string) => {
    if (id) {
      const s = data.students.find(x => x.id === id);
      if (s) setFormData({ id: s.id, name: s.name, class: s.class, password: s.password || '', photo: s.photo || '' });
    } else {
      setFormData({ id: 'STU' + Date.now(), name: '', class: 'Primary 5', password: 'pass', photo: '' });
    }
    setEditingId(id || null);
    setIsOpen(true);
  };

  const saveStudent = () => {
    const trimmedId = formData.id.trim();
    const trimmedName = formData.name.trim();
    if (!trimmedId || !trimmedName) return showToast('ID and Name are required');
    
    const cleanStudent = {
      ...formData,
      id: trimmedId,
      name: trimmedName,
      class: (formData.class || '').trim() || 'Primary 5'
    };

    if (!editingId) {
      if (data.students.some(s => s.id.toLowerCase() === cleanStudent.id.toLowerCase())) {
        return showToast(`Student ID "${cleanStudent.id}" already exists`);
      }
      if (data.teachers.some(t => t.id.toLowerCase() === cleanStudent.id.toLowerCase())) {
        return showToast(`ID "${cleanStudent.id}" is already used by a Teacher`);
      }
      if (data.admins.some(a => a.id.toLowerCase() === cleanStudent.id.toLowerCase())) {
        return showToast(`ID "${cleanStudent.id}" is already used by an Administrator`);
      }
    }

    updateData(draft => {
      if (editingId) {
        const i = draft.students.findIndex(x => x.id === editingId);
        if (i >= 0) draft.students[i] = { ...draft.students[i], ...cleanStudent };
      } else {
        draft.students.push(cleanStudent);
      }
    });
    showToast('Student saved');
    setIsOpen(false);
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    updateData(draft => {
      draft.students = draft.students.filter(s => s.id !== deleteConfirm);
      draft.results = draft.results.filter(r => r.studentId !== deleteConfirm);
      draft.attendance = draft.attendance.filter(a => a.studentId !== deleteConfirm);
    });
    showToast('Student deleted');
    setDeleteConfirm(null);
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
        <Button onClick={() => openForm()}>+ Add Student</Button>
      </div>
      
      <div className="overflow-x-auto bg-white rounded-lg shadow border border-slate-200">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left">
              <th className="p-3 font-semibold w-12">Photo</th>
              <th className="p-3 font-semibold">ID</th>
              <th className="p-3 font-semibold">Name</th>
              <th className="p-3 font-semibold">Class</th>
              <th className="p-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.students.map(s => (
              <tr key={s.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                <td className="p-3">
                  {s.photo ? <img src={s.photo} alt={s.name} className="w-8 h-8 rounded-full object-cover" /> : <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs">{s.name.charAt(0)}</div>}
                </td>
                <td className="p-3 font-mono text-sm">{s.id}</td>
                <td className="p-3 font-medium">{s.name}</td>
                <td className="p-3">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {s.class}
                  </span>
                </td>
                <td className="p-3 flex items-center gap-2">
                  <Button variant="secondary" onClick={() => openForm(s.id)}>Edit</Button>
                  <button
                    onClick={() => setDeleteConfirm(s.id)}
                    className="text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1.5 rounded transition-colors font-medium cursor-pointer"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {data.students.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  No students registered yet. Click &quot;+ Add Student&quot; to register students.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <h2 className="text-xl font-bold mt-0">{editingId ? 'Edit' : 'Add'} Student</h2>
        
        <Label>Student ID</Label>
        <Input value={formData.id} onChange={e => setFormData(p => ({ ...p, id: e.target.value }))} readOnly={!!editingId} />
        
        <Label>Full Name</Label>
        <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Aisha Bello" />
        
        <Label>Class</Label>
        <div className="flex gap-2 mb-2">
          <Select 
            value={CLASS_OPTIONS.includes(formData.class) ? formData.class : 'Other'} 
            onChange={e => {
              const val = e.target.value;
              if (val !== 'Other') {
                setFormData(p => ({ ...p, class: val }));
              }
            }}
          >
            {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        <Label className="text-xs text-slate-500">Custom class or arm/section (e.g. Primary 5A, Primary 5 Gold):</Label>
        <Input 
          value={formData.class} 
          placeholder="e.g. Primary 5 or Primary 5A" 
          onChange={e => setFormData(p => ({ ...p, class: e.target.value }))} 
        />
        
        <Label>Password</Label>
        <Input value={formData.password} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} />
        
        <Label>Photo</Label>
        <Input type="file" accept="image/*" onChange={handlePhoto} />
        
        <div className="flex gap-2 mt-5">
          <Button onClick={saveStudent}>Save Student</Button>
          <Button variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
        </div>
      </Modal>

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center">
            <h3 className="text-xl font-bold mb-2">Delete Student?</h3>
            <p className="text-slate-500 mb-6">Are you sure you want to delete this student and their associated test results?</p>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="danger" onClick={confirmDelete}>Yes, Delete</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
