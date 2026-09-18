import { useState } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Input, Label, Modal, Select } from '../components/ui';
import { CLASS_OPTIONS } from '../constants';

export default function AdminTeachers() {
  const { data, updateData } = useStore();
  const showToast = useToastStore(s => s.showToast);
  
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({ id: '', name: '', password: '', subjects: [] as string[], classes: [] as string[], otherClass: '' });

  const openForm = (id?: string) => {
    if (id) {
      const t = data.teachers.find(x => x.id === id);
      if (t) {
        const otherClass = t.classes.find(c => !CLASS_OPTIONS.includes(c)) || '';
        setFormData({ id: t.id, name: t.name, password: t.password || '', subjects: t.subjects, classes: t.classes, otherClass });
      }
    } else {
      setFormData({ id: '', name: '', password: 'pass', subjects: [], classes: [], otherClass: '' });
    }
    setEditingId(id || null);
    setIsOpen(true);
  };

  const saveTeacher = () => {
    const trimmedId = formData.id.trim();
    const trimmedName = formData.name.trim();
    if (!trimmedId || !trimmedName) return showToast('ID and Name are required');
    
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

    updateData(draft => {
      if (editingId) {
        const i = draft.teachers.findIndex(x => x.id === editingId);
        if (i >= 0) draft.teachers[i] = { ...draft.teachers[i], id: trimmedId, name: trimmedName, password: formData.password || 'pass', subjects: formData.subjects, classes: finalClasses };
      } else {
        draft.teachers.push({ id: trimmedId, name: trimmedName, password: formData.password || 'pass', subjects: formData.subjects, classes: finalClasses });
      }
    });
    showToast('Teacher saved');
    setIsOpen(false);
  };

  const deleteTeacher = (id: string) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      updateData(draft => {
        draft.teachers = draft.teachers.filter(t => t.id !== deleteConfirm);
      });
      showToast('Teacher deleted');
      setDeleteConfirm(null);
    }
  };

  return (
    <>
      <div className="flex gap-2 flex-wrap mb-4">
        <Button onClick={() => openForm()}>Add Teacher</Button>
      </div>
      
      <div className="overflow-x-auto bg-white rounded-lg shadow border border-slate-200">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left">
              <th className="p-3 font-semibold">ID</th>
              <th className="p-3 font-semibold">Name</th>
              <th className="p-3 font-semibold">Subjects</th>
              <th className="p-3 font-semibold">Classes</th>
              <th className="p-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.teachers.map(t => (
              <tr key={t.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                <td className="p-3">{t.id}</td>
                <td className="p-3">{t.name}</td>
                <td className="p-3">{t.subjects?.join(', ') || '—'}</td>
                <td className="p-3">{t.classes?.join(', ') || '—'}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => openForm(t.id)}>Edit</Button>
                    <Button variant="danger" onClick={() => deleteTeacher(t.id)}>Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <h2 className="text-xl font-bold mt-0">{editingId ? 'Edit' : 'Add'} Teacher</h2>
        
        <Label>ID</Label>
        <Input value={formData.id} onChange={e => setFormData(p => ({ ...p, id: e.target.value }))} readOnly={!!editingId} />
        
        <Label>Name</Label>
        <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
        
        <Label>Password</Label>
        <Input type="password" value={formData.password} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} />
        
        <Label>Subjects (Hold Ctrl/Cmd to multi-select)</Label>
        <Select 
          multiple 
          size={6} 
          value={formData.subjects} 
          onChange={e => setFormData(p => ({ ...p, subjects: Array.from(e.target.selectedOptions, (o: HTMLOptionElement) => o.value) }))}
        >
          {data.subjects.map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
        
        <Label>Classes Assigned to Teacher</Label>
        <div className="mb-3">
          <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg min-h-[42px] items-center mb-2">
            {formData.classes.map(c => (
              <span key={c} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-600 text-white shadow-sm">
                {c}
                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, classes: p.classes.filter(x => x !== c) }))}
                  className="hover:bg-indigo-700 rounded-full w-4 h-4 inline-flex items-center justify-center text-xs font-bold leading-none cursor-pointer"
                  title={`Remove ${c}`}
                >
                  ×
                </button>
              </span>
            ))}
            {formData.classes.length === 0 && (
              <span className="text-xs text-slate-400 italic">No classes selected. Click below to add classes.</span>
            )}
          </div>

          <p className="text-xs text-slate-500 mb-1.5 font-medium">Click any class to assign / unassign:</p>
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 border border-slate-100 rounded-lg bg-white">
            {CLASS_OPTIONS.map(c => {
              const isSelected = formData.classes.includes(c);
              return (
                <button
                  type="button"
                  key={c}
                  onClick={() => {
                    setFormData(p => ({
                      ...p,
                      classes: isSelected 
                        ? p.classes.filter(x => x !== c)
                        : [...p.classes, c]
                    }));
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {isSelected ? `✓ ${c}` : `+ ${c}`}
                </button>
              );
            })}
          </div>
        </div>
        
        <Label>Other / custom class (optional)</Label>
        <div className="flex gap-2">
          <Input 
            value={formData.otherClass} 
            placeholder="e.g. Primary 5A or Reception" 
            onChange={e => setFormData(p => ({ ...p, otherClass: e.target.value }))} 
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
              Add
            </Button>
          )}
        </div>
        
        <div className="flex gap-2 mt-5">
          <Button onClick={saveTeacher}>Save</Button>
          <Button variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
        </div>
      </Modal>

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center">
            <h3 className="text-xl font-bold mb-2">Delete Teacher?</h3>
            <p className="text-slate-500 mb-6">Are you sure you want to delete this teacher profile?</p>
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
