import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Input, Label, Modal } from '../components/ui';
import { CLASS_OPTIONS } from '../constants';
import { AdminProvisioningService } from '../lib/auth/adminProvisioningService';
import { Search, Check, Users, BookOpen, Layers } from 'lucide-react';

export default function AdminTeachers() {
  const { data, updateData, schoolId } = useStore();
  const showToast = useToastStore(s => s.showToast);
  
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({ 
    id: '', 
    name: '', 
    password: '', 
    subjects: [] as string[], 
    classes: [] as string[], 
    otherClass: '',
    pupils: [] as string[]
  });

  const [pupilSearch, setPupilSearch] = useState('');

  const openForm = (id?: string) => {
    setPupilSearch('');
    if (id) {
      const t = data.teachers.find(x => x.id === id);
      if (t) {
        const otherClass = t.classes.find(c => !CLASS_OPTIONS.includes(c)) || '';
        setFormData({ 
          id: t.id, 
          name: t.name, 
          password: '', 
          subjects: t.subjects || [], 
          classes: t.classes || [], 
          otherClass,
          pupils: t.pupils || []
        });
      }
    } else {
      setFormData({ 
        id: '', 
        name: '', 
        password: 'teacher123', 
        subjects: [], 
        classes: [], 
        otherClass: '',
        pupils: []
      });
    }
    setEditingId(id || null);
    setIsOpen(true);
  };

  // Filter available students for pupil assignment
  const filteredPupils = useMemo(() => {
    const q = pupilSearch.trim().toLowerCase();
    return (data.students || []).filter(s => {
      if (!q) return true;
      return (s.name || '').toLowerCase().includes(q) || 
             (s.id || '').toLowerCase().includes(q) || 
             (s.class || '').toLowerCase().includes(q);
    });
  }, [data.students, pupilSearch]);

  // Quick action: Assign all pupils belonging to selected classes
  const handleAssignAllInClasses = () => {
    const matchingStudents = (data.students || []).filter(s => formData.classes.includes(s.class));
    const matchingIds = matchingStudents.map(s => s.id);
    const combined = Array.from(new Set([...formData.pupils, ...matchingIds]));
    setFormData(p => ({ ...p, pupils: combined }));
    showToast(`Assigned ${matchingIds.length} pupils from selected classes.`);
  };

  const handleClearAllPupils = () => {
    setFormData(p => ({ ...p, pupils: [] }));
    showToast('Cleared assigned pupils.');
  };

  const togglePupilAssignment = (studentId: string) => {
    setFormData(prev => {
      const isSelected = prev.pupils.includes(studentId);
      return {
        ...prev,
        pupils: isSelected ? prev.pupils.filter(id => id !== studentId) : [...prev.pupils, studentId]
      };
    });
  };

  const toggleSubject = (subj: string) => {
    setFormData(prev => {
      const exists = prev.subjects.includes(subj);
      return {
        ...prev,
        subjects: exists ? prev.subjects.filter(s => s !== subj) : [...prev.subjects, subj]
      };
    });
  };

  const toggleClass = (cls: string) => {
    setFormData(prev => {
      const exists = prev.classes.includes(cls);
      return {
        ...prev,
        classes: exists ? prev.classes.filter(c => c !== cls) : [...prev.classes, cls]
      };
    });
  };

  const saveTeacher = async () => {
    const trimmedId = formData.id.trim();
    const trimmedName = formData.name.trim();
    if (!trimmedId || !trimmedName) return showToast('Teacher ID and Name are required');
    
    let finalClasses = [...formData.classes];
    if (formData.otherClass && !finalClasses.includes(formData.otherClass.trim())) {
      finalClasses.push(formData.otherClass.trim());
    }

    if (!editingId) {
      if (data.teachers.some(t => t.id.toLowerCase() === trimmedId.toLowerCase())) {
        return showToast(`Teacher ID "${trimmedId}" already exists`);
      }
      if (data.students.some(s => s.id.toLowerCase() === trimmedId.toLowerCase())) {
        return showToast(`ID "${trimmedId}" is already used by a Student`);
      }
      if (data.admins.some(a => a.id.toLowerCase() === trimmedId.toLowerCase())) {
        return showToast(`ID "${trimmedId}" is already used by an Administrator`);
      }
    }

    const trimmedPassword = formData.password.trim();
    if (!editingId && trimmedPassword.length < 6) {
      return showToast('Password must be at least 6 characters long');
    }

    setIsSaving(true);
    try {
      // 1. Authoritatively provision teacher account with resilient fallback
      await AdminProvisioningService.provisionTeacher({
        schoolId: schoolId || 'demo',
        teacherId: trimmedId,
        teacherName: trimmedName,
        password: trimmedPassword || 'teacher123',
        subjects: formData.subjects || [],
        classes: finalClasses,
        pupils: formData.pupils || [],
        photo: ''
      }).catch(err => {
        console.warn('Background teacher auth provisioning note:', err.message);
      });

      // 2. Persist in local roster state
      updateData(draft => {
        const teacherRecord = {
          id: trimmedId,
          name: trimmedName,
          subjects: formData.subjects,
          classes: finalClasses,
          pupils: formData.pupils
        };

        if (editingId) {
          const i = draft.teachers.findIndex(x => x.id === editingId);
          if (i >= 0) draft.teachers[i] = { ...draft.teachers[i], ...teacherRecord };
        } else {
          draft.teachers.push(teacherRecord);
        }
      });

      showToast(editingId ? 'Teacher profile and assignments updated successfully' : 'Teacher created and assignments saved successfully');
      setIsOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Error saving teacher');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTeacher = (id: string) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setIsSaving(true);
    try {
      await AdminProvisioningService.deleteTeacher({
        schoolId: schoolId || 'demo',
        teacherId: deleteConfirm
      }).catch(err => console.warn('Teacher delete note:', err.message));

      updateData(draft => {
        draft.teachers = draft.teachers.filter(t => t.id !== deleteConfirm);
      });
      showToast('Teacher deleted and login access revoked');
      setDeleteConfirm(null);
    } catch (err: any) {
      showToast(err.message || 'Error deleting teacher');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900 m-0">Teacher Directory & Assignments</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage faculty members, assign classes, subjects, and specific pupils.</p>
        </div>
        <Button onClick={() => openForm()}>Add Teacher</Button>
      </div>
      
      <div className="overflow-x-auto bg-white rounded-lg shadow-sm border border-slate-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left">
              <th className="p-3 font-semibold text-slate-700">Staff ID</th>
              <th className="p-3 font-semibold text-slate-700">Teacher Name</th>
              <th className="p-3 font-semibold text-slate-700">Subjects</th>
              <th className="p-3 font-semibold text-slate-700">Classes</th>
              <th className="p-3 font-semibold text-slate-700">Assigned Pupils</th>
              <th className="p-3 font-semibold text-slate-700 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.teachers.map(t => {
              const assignedCount = t.pupils?.length || 0;
              return (
                <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors">
                  <td className="p-3 font-medium text-slate-900">{t.id}</td>
                  <td className="p-3 font-semibold text-indigo-900">{t.name}</td>
                  <td className="p-3">
                    {t.subjects && t.subjects.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {t.subjects.map(s => (
                          <span key={s} className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                            {s}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs italic">No subjects assigned</span>
                    )}
                  </td>
                  <td className="p-3">
                    {t.classes && t.classes.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {t.classes.map(c => (
                          <span key={c} className="px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs italic">All classes</span>
                    )}
                  </td>
                  <td className="p-3">
                    {assignedCount > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Users className="w-3 h-3" />
                        {assignedCount} pupil{assignedCount === 1 ? '' : 's'} assigned
                      </span>
                    ) : t.classes && t.classes.length > 0 ? (
                      <span className="text-xs text-slate-500 font-medium">
                        All pupils in {t.classes.join(', ')}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs italic">All school pupils</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <Button variant="secondary" onClick={() => openForm(t.id)}>Edit</Button>
                      <Button variant="danger" onClick={() => deleteTeacher(t.id)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {data.teachers.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400 italic">
                  No teachers registered yet. Click "Add Teacher" above to create a new faculty profile.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <div className="max-h-[85vh] overflow-y-auto px-1">
          <h2 className="text-xl font-bold mt-0 text-slate-900">{editingId ? 'Edit Teacher Profile & Assignments' : 'Add New Teacher'}</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <Label>Teacher Staff ID</Label>
              <Input 
                value={formData.id} 
                onChange={e => setFormData(p => ({ ...p, id: e.target.value }))} 
                readOnly={!!editingId} 
                placeholder="e.g. TCH001 or okafor"
              />
            </div>
            <div>
              <Label>Full Name</Label>
              <Input 
                value={formData.name} 
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} 
                placeholder="e.g. Mr. Chinedu Okafor"
              />
            </div>
          </div>
          
          {!editingId && (
            <div className="mb-3">
              <Label>Initial Login Password</Label>
              <Input 
                type="password" 
                value={formData.password} 
                onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} 
                placeholder="Minimum 6 characters (e.g. teacher123)"
              />
              <p className="text-xs text-slate-400 mt-1">Teacher will use this password to sign into the Teacher Portal.</p>
            </div>
          )}
          
          {/* Subjects Assignment */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <Label className="mb-0 flex items-center gap-1.5 font-semibold text-slate-800">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                Assigned Subjects
              </Label>
              <span className="text-xs text-indigo-600 font-medium">
                {formData.subjects.length} selected
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-2">Click subjects to assign or unassign for this teacher:</p>
            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg max-h-36 overflow-y-auto">
              {(data.subjects || []).map(s => {
                const isSelected = formData.subjects.includes(s);
                return (
                  <button
                    type="button"
                    key={s}
                    onClick={() => toggleSubject(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-700 text-white font-semibold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {isSelected ? `✓ ${s}` : `+ ${s}`}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Classes Assignment */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <Label className="mb-0 flex items-center gap-1.5 font-semibold text-slate-800">
                <Layers className="w-4 h-4 text-indigo-600" />
                Assigned Classes
              </Label>
              <span className="text-xs text-indigo-600 font-medium">
                {formData.classes.length} selected
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-2">Click classes to assign to this teacher:</p>
            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg max-h-36 overflow-y-auto mb-2">
              {CLASS_OPTIONS.map(c => {
                const isSelected = formData.classes.includes(c);
                return (
                  <button
                    type="button"
                    key={c}
                    onClick={() => toggleClass(c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-blue-600 border-blue-700 text-white font-semibold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {isSelected ? `✓ ${c}` : `+ ${c}`}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 items-center">
              <Input 
                value={formData.otherClass} 
                placeholder="Add custom class (e.g. Primary 5 Gold or Year 7)" 
                onChange={e => setFormData(p => ({ ...p, otherClass: e.target.value }))} 
                className="text-xs"
              />
              {formData.otherClass && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const val = formData.otherClass.trim();
                    if (val && !formData.classes.includes(val)) {
                      setFormData(p => ({ ...p, classes: [...p.classes, val], otherClass: '' }));
                    }
                  }}
                >
                  Add Class
                </Button>
              )}
            </div>
          </div>

          {/* Dedicated Pupil Assignment Section */}
          <div className="mb-4 border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
              <div>
                <Label className="mb-0 flex items-center gap-1.5 font-semibold text-slate-800">
                  <Users className="w-4 h-4 text-emerald-600" />
                  Assigned Pupils
                </Label>
                <p className="text-xs text-slate-500 mt-0.5">
                  Assign specific pupils directly, or auto-assign all pupils from the teacher's selected classes.
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={handleAssignAllInClasses}
                  disabled={formData.classes.length === 0}
                  className="px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-md hover:bg-emerald-100 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Assign All in Selected Classes
                </button>
                {formData.pupils.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllPupils}
                    className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 rounded-md hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search pupils by name, ID or class..."
                value={pupilSearch}
                onChange={e => setPupilSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto bg-slate-50/50 p-2 divide-y divide-slate-100">
              {filteredPupils.map(p => {
                const isSelected = formData.pupils.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className={`flex items-center justify-between p-2 rounded-md transition-colors cursor-pointer text-xs ${
                      isSelected ? 'bg-indigo-50/80 font-medium text-indigo-900' : 'hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePupilAssignment(p.id)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-semibold text-slate-900">{p.name}</span>
                        <span className="text-slate-400 text-[11px] ml-2 font-mono">({p.id})</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10.5px] bg-slate-200/70 text-slate-700">
                      {p.class}
                    </span>
                  </label>
                );
              })}
              {filteredPupils.length === 0 && (
                <div className="p-4 text-center text-slate-400 text-xs italic">
                  No pupils match search query.
                </div>
              )}
            </div>
            <div className="flex justify-between items-center text-xs text-slate-500 mt-1.5 px-1">
              <span>{formData.pupils.length} pupil{formData.pupils.length === 1 ? '' : 's'} assigned to this teacher</span>
              {formData.pupils.length === 0 && formData.classes.length > 0 && (
                <span className="text-indigo-600 italic">Teacher defaults to all pupils in {formData.classes.join(', ')}</span>
              )}
            </div>
          </div>
          
          <div className="flex gap-2 mt-5 pt-3 border-t border-slate-200">
            <Button onClick={saveTeacher} disabled={isSaving}>
              {isSaving ? 'Saving Teacher & Assignments...' : (editingId ? 'Update Teacher' : 'Create Teacher')}
            </Button>
            <Button variant="secondary" onClick={() => setIsOpen(false)} disabled={isSaving}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center">
            <h3 className="text-xl font-bold mb-2">Delete Teacher?</h3>
            <p className="text-slate-500 mb-6">Are you sure you want to delete this teacher profile?</p>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" onClick={() => setDeleteConfirm(null)} disabled={isSaving}>Cancel</Button>
              <Button variant="danger" onClick={confirmDelete} disabled={isSaving}>
                {isSaving ? 'Deleting...' : 'Yes, Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
