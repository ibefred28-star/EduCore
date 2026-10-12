import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Input, Label, Modal, Select } from '../components/ui';
import { CLASS_OPTIONS } from '../constants';
import { StudentRepository } from '../lib/firestore/repositories/studentRepository';
import { AdminProvisioningService } from '../lib/auth/adminProvisioningService';
import { useStudentsSubscription } from '../hooks/useDomainSubscriptions';
import { KeyRound, RefreshCw, UserCheck, ShieldCheck } from 'lucide-react';

export default function AdminStudents() {
  const { data, updateData, schoolId } = useStore();
  const showToast = useToastStore(s => s.showToast);

  // Real-time Firestore subscription for student roster
  const { students: liveStudents, loading: studentsLoading } = useStudentsSubscription(schoolId);

  const displayStudents = useMemo(() => {
    if (!studentsLoading && Array.isArray(liveStudents)) {
      return liveStudents.map(s => ({
        id: s.id,
        name: s.name,
        class: s.class,
        photo: s.photo || ''
      }));
    }
    return (data.students || []).map(s => ({
      id: s.id,
      name: s.name,
      class: s.class,
      photo: s.photo || ''
    }));
  }, [liveStudents, studentsLoading, data.students]);
  
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  
  const [formData, setFormData] = useState({ id: '', name: '', class: 'Primary 5', password: '', photo: '' });
  const [resetModal, setResetModal] = useState({ isOpen: false, studentId: '', studentName: '', newPassword: '' });

  const openForm = (id?: string) => {
    if (id) {
      const s = displayStudents.find(x => x.id === id);
      if (s) setFormData({ id: s.id, name: s.name, class: s.class, password: '', photo: s.photo || '' });
    } else {
      setFormData({ id: 'STU' + Date.now().toString().slice(-4), name: '', class: 'Primary 5', password: 'student123', photo: '' });
    }
    setEditingId(id || null);
    setIsOpen(true);
  };

  const saveStudent = async () => {
    const trimmedId = formData.id.trim();
    const trimmedName = formData.name.trim();
    if (!trimmedId || !trimmedName) return showToast('ID and Name are required');
    
    const trimmedPass = (formData.password || '').trim();
    if (!editingId && (!trimmedPass || trimmedPass.length < 6)) {
      return showToast('Password must be at least 6 characters long for login');
    }
    if (editingId && trimmedPass && trimmedPass.length < 6) {
      return showToast('Password must be at least 6 characters long');
    }

    const cleanStudent = {
      id: trimmedId,
      name: trimmedName,
      class: (formData.class || '').trim() || 'Primary 5',
      photo: formData.photo || ''
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

    setIsProvisioning(true);
    try {
      // 1. Authoritatively provision the student's authentication account via server-side API
      const provRes = await AdminProvisioningService.provisionStudent({
        schoolId: schoolId || 'default',
        studentId: cleanStudent.id,
        studentName: cleanStudent.name,
        studentClass: cleanStudent.class,
        password: trimmedPass || 'student123',
        photo: cleanStudent.photo,
        isUpdate: Boolean(editingId)
      });

      if (!provRes.success) {
        showToast(provRes.error || 'Failed to provision student login account in Firebase Authentication');
        setIsProvisioning(false);
        return;
      }

      // 2. Persist in local and remote roster (WITHOUT storing plaintext password!)
      updateData(draft => {
        if (editingId) {
          const i = draft.students.findIndex(x => x.id === editingId);
          if (i >= 0) draft.students[i] = { ...draft.students[i], ...cleanStudent };
        } else {
          draft.students.push(cleanStudent);
        }
      });

      // 3. Persist in Firestore Student repository with linked Auth UID
      if (schoolId) {
        StudentRepository.upsertStudent(schoolId, { ...cleanStudent, uid: provRes.uid }).catch(console.warn);
      }

      showToast(editingId ? 'Student updated and credentials synchronized' : 'Student account created and credentials ready');
      setIsOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Error saving student');
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetModal.studentId || !resetModal.newPassword) {
      return showToast('Please enter a new password');
    }
    if (resetModal.newPassword.trim().length < 6) {
      return showToast('Password must be at least 6 characters long');
    }

    try {
      const res = await AdminProvisioningService.resetStudentPassword({
        schoolId: schoolId || 'default',
        studentId: resetModal.studentId,
        newPassword: resetModal.newPassword.trim()
      });

      if (res.success) {
        showToast(`Password for ${resetModal.studentName} updated successfully`);
        setResetModal({ isOpen: false, studentId: '', studentName: '', newPassword: '' });
      } else {
        showToast(res.error || 'Failed to reset password');
      }
    } catch (err: any) {
      showToast(err.message || 'Error resetting password');
    }
  };

  const handleSyncAllStudents = async () => {
    if (!displayStudents.length) return showToast('No students to sync');
    setIsSyncingAll(true);
    try {
      const res = await AdminProvisioningService.syncAllStudents(schoolId || 'default', displayStudents);
      if (res.success) {
        showToast(`Successfully provisioned ${res.count} student accounts in Firebase Auth`);
      } else {
        showToast(res.error || 'Failed to sync students to Firebase Auth');
      }
    } catch (err: any) {
      showToast(err.message || 'Sync error');
    } finally {
      setIsSyncingAll(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    if (!schoolId) {
      showToast('No active school selected');
      return;
    }
    try {
      // 1. Authoritatively delete Firebase Auth account and server profiles
      const res = await AdminProvisioningService.deleteStudent({
        schoolId,
        studentId: deleteConfirm
      });

      if (!res.success) {
        showToast(res.error || 'Failed to delete student from Firebase Authentication.');
        return;
      }

      // 2. Remove student from active student roster (preserving results & attendance for academic integrity)
      updateData(draft => {
        draft.students = draft.students.filter(s => s.id !== deleteConfirm);
      });

      if (schoolId) {
        StudentRepository.deleteStudent(schoolId, deleteConfirm).catch(console.warn);
      }

      showToast('Student deleted and authentication credentials revoked');
      setDeleteConfirm(null);
    } catch (err: any) {
      showToast(err.message || 'Error deleting student');
    }
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
      <div className="flex gap-2 flex-wrap mb-4 justify-between items-center">
        <Button onClick={() => openForm()} className="inline-flex items-center gap-1.5">
          + Add Student
        </Button>
        <Button
          variant="secondary"
          onClick={handleSyncAllStudents}
          disabled={isSyncingAll}
          className="inline-flex items-center gap-1.5 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
          {isSyncingAll ? 'Syncing with Auth...' : 'Sync All to Firebase Auth'}
        </Button>
      </div>
      
      <div className="overflow-x-auto bg-white rounded-lg shadow border border-slate-200">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left">
              <th className="p-3 font-semibold w-12">Photo</th>
              <th className="p-3 font-semibold">Admission / ID</th>
              <th className="p-3 font-semibold">Name</th>
              <th className="p-3 font-semibold">Class</th>
              <th className="p-3 font-semibold">Auth Status</th>
              <th className="p-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayStudents.map(s => (
              <tr key={s.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                <td className="p-3">
                  {s.photo ? <img src={s.photo} alt={s.name} className="w-8 h-8 rounded-full object-cover" /> : <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs">{s.name.charAt(0)}</div>}
                </td>
                <td className="p-3 font-mono text-sm font-semibold text-slate-800">{s.id}</td>
                <td className="p-3 font-medium">{s.name}</td>
                <td className="p-3">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {s.class}
                  </span>
                </td>
                <td className="p-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" /> Active Auth
                  </span>
                </td>
                <td className="p-3 flex items-center gap-1.5 flex-wrap">
                  <Button variant="secondary" onClick={() => openForm(s.id)} className="text-xs py-1 px-2.5">
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setResetModal({ isOpen: true, studentId: s.id, studentName: s.name, newPassword: '' })}
                    className="text-xs py-1 px-2.5 inline-flex items-center gap-1 text-slate-700"
                  >
                    <KeyRound className="w-3 h-3" /> Reset Pass
                  </Button>
                  <button
                    onClick={() => setDeleteConfirm(s.id)}
                    className="text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1.5 rounded transition-colors font-medium cursor-pointer"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {displayStudents.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
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
        
        <Label>{editingId ? 'New Password (leave blank to keep current)' : 'Password (min 6 characters)'}</Label>
        <Input 
          type="password"
          placeholder={editingId ? 'Leave blank or enter new password' : 'At least 6 characters'}
          value={formData.password} 
          onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} 
        />
        
        <Label>Photo</Label>
        <Input type="file" accept="image/*" onChange={handlePhoto} />
        
        <div className="flex gap-2 mt-5">
          <Button disabled={isProvisioning} onClick={saveStudent}>
            {isProvisioning ? 'Provisioning with Firebase Auth...' : 'Save Student'}
          </Button>
          <Button variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal isOpen={resetModal.isOpen} onClose={() => setResetModal(p => ({ ...p, isOpen: false }))}>
        <h2 className="text-xl font-bold mt-0 flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-indigo-600" /> Reset Student Password
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Provision a new login password for <strong className="text-slate-800">{resetModal.studentName}</strong> (ID: {resetModal.studentId}).
        </p>
        <Label>New Password (min 6 characters)</Label>
        <Input
          placeholder="e.g. newpass123"
          value={resetModal.newPassword}
          onChange={e => setResetModal(p => ({ ...p, newPassword: e.target.value }))}
        />
        <div className="flex gap-2 mt-5">
          <Button onClick={handleResetPassword}>Save & Update Password</Button>
          <Button variant="secondary" onClick={() => setResetModal(p => ({ ...p, isOpen: false }))}>Cancel</Button>
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
