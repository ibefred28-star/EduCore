import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Input, Label, Modal, Select } from '../components/ui';
import { CLASS_OPTIONS } from '../constants';
import { StudentRepository } from '../lib/firestore/repositories/studentRepository';
import { AdminProvisioningService } from '../lib/auth/adminProvisioningService';
import { useStudentsSubscription } from '../hooks/useDomainSubscriptions';
import { 
  KeyRound, 
  RefreshCw, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  Lock, 
  Printer, 
  Sparkles,
  User,
  Info
} from 'lucide-react';

export default function AdminStudents() {
  const { data, updateData, schoolId, branding } = useStore();
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
  
  // Password preview states
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showCredPassword, setShowCredPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [formData, setFormData] = useState({ 
    id: '', 
    name: '', 
    class: 'Primary 5', 
    password: '', 
    photo: '' 
  });

  const [resetModal, setResetModal] = useState({ 
    isOpen: false, 
    studentId: '', 
    studentName: '', 
    studentClass: '',
    newPassword: '' 
  });

  // Dedicated Student Credentials Preview Modal
  const [credentialModal, setCredentialModal] = useState<{
    isOpen: boolean;
    studentId: string;
    studentName: string;
    studentClass: string;
    password: string;
    isUpdating: boolean;
  }>({
    isOpen: false,
    studentId: '',
    studentName: '',
    studentClass: '',
    password: 'student123',
    isUpdating: false
  });

  const generateRandomPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let pass = 'edu';
    for (let i = 0; i < 5; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    showToast(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const openForm = (id?: string) => {
    setShowFormPassword(false);
    if (id) {
      const s = displayStudents.find(x => x.id === id);
      if (s) {
        setFormData({ 
          id: s.id, 
          name: s.name, 
          class: s.class, 
          password: '', 
          photo: s.photo || '' 
        });
      }
    } else {
      setFormData({ 
        id: 'STU' + Date.now().toString().slice(-4), 
        name: '', 
        class: 'Primary 5', 
        password: generateRandomPassword(), 
        photo: '' 
      });
    }
    setEditingId(id || null);
    setIsOpen(true);
  };

  const openCredentialPreview = (student: { id: string; name: string; class: string }) => {
    setShowCredPassword(false);
    setCredentialModal({
      isOpen: true,
      studentId: student.id,
      studentName: student.name,
      studentClass: student.class,
      password: 'student123',
      isUpdating: false
    });
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
      // 1. Authoritatively provision the student's authentication account via server API with resilient fallback
      const provRes = await AdminProvisioningService.provisionStudent({
        schoolId: schoolId || 'demo',
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

      // 2. Persist in local roster state
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
        await StudentRepository.upsertStudent(schoolId, { ...cleanStudent, uid: provRes.uid }).catch(console.warn);
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
        schoolId: schoolId || 'demo',
        studentId: resetModal.studentId,
        newPassword: resetModal.newPassword.trim()
      });

      if (res.success) {
        showToast(`Password for ${resetModal.studentName} updated successfully`);
        setResetModal({ isOpen: false, studentId: '', studentName: '', studentClass: '', newPassword: '' });
      } else {
        showToast(res.error || 'Failed to reset password');
      }
    } catch (err: any) {
      showToast(err.message || 'Error resetting password');
    }
  };

  const handleUpdatePasswordFromPreview = async () => {
    if (!credentialModal.password || credentialModal.password.trim().length < 6) {
      return showToast('Password must be at least 6 characters long');
    }

    setCredentialModal(p => ({ ...p, isUpdating: true }));
    try {
      const res = await AdminProvisioningService.resetStudentPassword({
        schoolId: schoolId || 'demo',
        studentId: credentialModal.studentId,
        newPassword: credentialModal.password.trim()
      });

      if (res.success) {
        showToast(`Credentials updated for ${credentialModal.studentName}!`);
      } else {
        showToast(res.error || 'Failed to update credentials in Firebase Auth');
      }
    } catch (err: any) {
      showToast(err.message || 'Error updating password');
    } finally {
      setCredentialModal(p => ({ ...p, isUpdating: false }));
    }
  };

  const handleSyncAllStudents = async () => {
    if (!displayStudents.length) return showToast('No students to sync');
    setIsSyncingAll(true);
    try {
      const res = await AdminProvisioningService.syncAllStudents(schoolId || 'demo', displayStudents);
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
      const res = await AdminProvisioningService.deleteStudent({
        schoolId,
        studentId: deleteConfirm
      });

      if (!res.success) {
        showToast(res.error || 'Failed to delete student from Firebase Authentication.');
        return;
      }

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

  const copyLoginSlip = (studentId: string, studentName: string, studentClass: string, pass: string) => {
    const slip = `==============================
EDUCORE STUDENT LOGIN SLIP
==============================
School: ${branding.schoolName || 'EduCore Academy'}
Student Name: ${studentName}
Admission / Student ID: ${studentId}
Class: ${studentClass}
System Email: ${(schoolId || 'demo').toLowerCase()}.student.${studentId.toLowerCase()}@educore.internal
Password: ${pass}
Portal: ${window.location.origin}
==============================`;
    copyToClipboard(slip, 'Complete login slip');
  };

  return (
    <>
      <div className="flex gap-2 flex-wrap mb-4 justify-between items-center">
        <Button onClick={() => openForm()} className="inline-flex items-center gap-1.5 shadow-xs">
          + Add Student
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleSyncAllStudents}
            disabled={isSyncingAll}
            className="inline-flex items-center gap-1.5 text-xs shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
            {isSyncingAll ? 'Syncing with Auth...' : 'Sync All to Firebase Auth'}
          </Button>
        </div>
      </div>
      
      <div className="overflow-x-auto bg-white rounded-xl shadow-xs border border-slate-200">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-600">
              <th className="p-3 font-bold w-12">Photo</th>
              <th className="p-3 font-bold">Admission / ID</th>
              <th className="p-3 font-bold">Name</th>
              <th className="p-3 font-bold">Class</th>
              <th className="p-3 font-bold">Auth Status</th>
              <th className="p-3 font-bold">Credentials</th>
              <th className="p-3 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayStudents.map(s => {
              const studentEmail = `${(schoolId || 'demo').toLowerCase()}.student.${s.id.toLowerCase()}@educore.internal`;
              return (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3">
                    {s.photo ? (
                      <img src={s.photo} alt={s.name} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                        {s.name.charAt(0)}
                      </div>
                    )}
                  </td>
                  <td className="p-3 font-mono text-xs font-bold text-slate-800">
                    {s.id}
                  </td>
                  <td className="p-3 font-semibold text-slate-900 text-sm">
                    {s.name}
                  </td>
                  <td className="p-3">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {s.class}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Active Auth
                    </span>
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => openCredentialPreview(s)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 transition-all cursor-pointer"
                      title="Preview and edit login password"
                    >
                      <Lock className="w-3 h-3 text-indigo-600" />
                      <span>Credentials & Pass</span>
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex items-center gap-1.5 justify-end">
                      <Button variant="secondary" onClick={() => openForm(s.id)} className="text-xs py-1 px-2.5">
                        Edit
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setResetModal({ 
                          isOpen: true, 
                          studentId: s.id, 
                          studentName: s.name, 
                          studentClass: s.class,
                          newPassword: generateRandomPassword() 
                        })}
                        className="text-xs py-1 px-2.5 inline-flex items-center gap-1 text-slate-700"
                        title="Quick reset password"
                      >
                        <KeyRound className="w-3 h-3" /> Reset
                      </Button>
                      <button
                        onClick={() => setDeleteConfirm(s.id)}
                        className="text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1.5 rounded transition-colors font-medium cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {displayStudents.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500 text-sm">
                  No students registered yet. Click &quot;+ Add Student&quot; to register students.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Student Modal */}
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold mt-0 text-slate-900">{editingId ? 'Edit Student Details' : 'Register New Student'}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {editingId ? 'Update pupil profile and login credentials in Firebase Auth.' : 'Creates pupil profile and provisions login account in Firebase Authentication.'}
            </p>
          </div>
          
          <div>
            <Label>Student / Admission ID</Label>
            <Input 
              value={formData.id} 
              onChange={e => setFormData(p => ({ ...p, id: e.target.value }))} 
              readOnly={!!editingId}
              placeholder="e.g. STU007" 
            />
          </div>
          
          <div>
            <Label>Full Pupil Name</Label>
            <Input 
              value={formData.name} 
              onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} 
              placeholder="e.g. Aisha Bello" 
            />
          </div>
          
          <div>
            <Label>Standard Class</Label>
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
            <div className="mt-1.5">
              <Label className="text-xs text-slate-500 font-normal">Custom class or arm/section (e.g. Primary 5A, Gold):</Label>
              <Input 
                value={formData.class} 
                placeholder="e.g. Primary 5 or Primary 5A" 
                onChange={e => setFormData(p => ({ ...p, class: e.target.value }))} 
              />
            </div>
          </div>
          
          {/* Student Password with Preview & Generation */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-800 m-0">
                {editingId ? 'Password (leave blank to keep current, or enter new)' : 'Login Password (min 6 characters)'}
              </Label>
              <button
                type="button"
                onClick={() => setFormData(p => ({ ...p, password: generateRandomPassword() }))}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded transition-colors"
              >
                <Sparkles className="w-3 h-3" /> Auto-Generate
              </button>
            </div>

            <div className="relative">
              <Input 
                type={showFormPassword ? 'text' : 'password'}
                placeholder={editingId ? 'Enter new password to change' : 'At least 6 characters'}
                value={formData.password} 
                onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} 
                className="pr-20 font-mono text-sm"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-white pl-1">
                <button
                  type="button"
                  onClick={() => setShowFormPassword(!showFormPassword)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                  title={showFormPassword ? 'Hide password' : 'Preview password'}
                >
                  {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                {formData.password && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(formData.password, 'Password')}
                    className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                    title="Copy password"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {formData.password && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                {formData.password.length >= 6 ? (
                  <span className="text-emerald-600 font-semibold inline-flex items-center gap-1">
                    <Check className="w-3 h-3" /> Password satisfies 6-character requirement
                  </span>
                ) : (
                  <span className="text-rose-500 font-medium">
                    Password is {formData.password.length}/6 characters (minimum 6 required)
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div>
            <Label>Pupil Photo (Optional)</Label>
            <Input type="file" accept="image/*" onChange={handlePhoto} />
          </div>
          
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <Button disabled={isProvisioning} onClick={saveStudent} className="flex-1">
              {isProvisioning ? 'Saving & Provisioning Auth...' : editingId ? 'Update Student' : 'Save Student'}
            </Button>
            <Button variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Student Credentials & Password Preview Modal */}
      <Modal isOpen={credentialModal.isOpen} onClose={() => setCredentialModal(p => ({ ...p, isOpen: false }))}>
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold">
              <Lock className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold m-0 text-slate-900">Student Login Credentials</h2>
              <p className="text-xs text-slate-500 m-0">View, preview, and update credentials for {credentialModal.studentName}</p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 block">Pupil Name & Class</span>
              <div className="flex items-center justify-between mt-0.5">
                <span className="font-bold text-slate-900 text-sm">{credentialModal.studentName}</span>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-white border border-slate-200 text-slate-700">
                  {credentialModal.studentClass}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 block">Admission / Student ID</span>
              <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200 mt-1">
                <span className="font-mono font-bold text-slate-900 text-sm">{credentialModal.studentId}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(credentialModal.studentId, 'Student ID')}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Copy ID
                </button>
              </div>
            </div>

            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 block">Authentication Login Email</span>
              <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200 mt-1">
                <span className="font-mono text-xs text-slate-700 truncate mr-2">
                  {`${(schoolId || 'demo').toLowerCase()}.student.${credentialModal.studentId.toLowerCase()}@educore.internal`}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(
                    `${(schoolId || 'demo').toLowerCase()}.student.${credentialModal.studentId.toLowerCase()}@educore.internal`,
                    'Login Email'
                  )}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold shrink-0 inline-flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 block">Password Preview & Edit</span>
                <button
                  type="button"
                  onClick={() => setCredentialModal(p => ({ ...p, password: generateRandomPassword() }))}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" /> Randomize
                </button>
              </div>
              <div className="relative mt-1">
                <Input
                  type={showCredPassword ? 'text' : 'password'}
                  value={credentialModal.password}
                  onChange={e => setCredentialModal(p => ({ ...p, password: e.target.value }))}
                  className="pr-20 font-mono text-sm"
                  placeholder="Enter new password (min 6 chars)"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-white pl-1">
                  <button
                    type="button"
                    onClick={() => setShowCredPassword(!showCredPassword)}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                    title={showCredPassword ? 'Hide password' : 'Show / preview password'}
                  >
                    {showCredPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(credentialModal.password, 'Password')}
                    className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                    title="Copy password"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <Button 
              onClick={handleUpdatePasswordFromPreview}
              disabled={credentialModal.isUpdating}
              className="w-full justify-center"
            >
              {credentialModal.isUpdating ? 'Updating in Firebase Auth...' : 'Save & Update Password in Auth'}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => copyLoginSlip(
                  credentialModal.studentId, 
                  credentialModal.studentName, 
                  credentialModal.studentClass, 
                  credentialModal.password
                )}
                className="flex-1 justify-center text-xs"
              >
                <Copy className="w-3.5 h-3.5 mr-1" /> Copy Printable Slip
              </Button>
              <Button
                variant="secondary"
                onClick={() => setCredentialModal(p => ({ ...p, isOpen: false }))}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Quick Reset Password Modal */}
      <Modal isOpen={resetModal.isOpen} onClose={() => setResetModal(p => ({ ...p, isOpen: false }))}>
        <div className="space-y-4">
          <h2 className="text-xl font-bold mt-0 flex items-center gap-2 text-slate-900">
            <KeyRound className="w-5 h-5 text-indigo-600" /> Reset Student Password
          </h2>
          <p className="text-xs text-slate-500">
            Set and synchronize a new login password for <strong className="text-slate-800">{resetModal.studentName}</strong> (ID: {resetModal.studentId}).
          </p>
          
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="m-0">New Password (min 6 characters)</Label>
              <button
                type="button"
                onClick={() => setResetModal(p => ({ ...p, newPassword: generateRandomPassword() }))}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" /> Auto-Generate
              </button>
            </div>
            
            <div className="relative">
              <Input
                type={showResetPassword ? 'text' : 'password'}
                placeholder="e.g. newpass123"
                value={resetModal.newPassword}
                onChange={e => setResetModal(p => ({ ...p, newPassword: e.target.value }))}
                className="pr-20 font-mono text-sm"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-white pl-1">
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                  title={showResetPassword ? 'Hide password' : 'Preview password'}
                >
                  {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                {resetModal.newPassword && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(resetModal.newPassword, 'New Password')}
                    className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                    title="Copy password"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <Button onClick={handleResetPassword} className="flex-1">
              Save & Synchronize Password
            </Button>
            <Button variant="secondary" onClick={() => setResetModal(p => ({ ...p, isOpen: false }))}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center">
            <h3 className="text-xl font-bold mb-2">Delete Student?</h3>
            <p className="text-slate-500 mb-6 text-sm">Are you sure you want to delete this student and their associated test results?</p>
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
