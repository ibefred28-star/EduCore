import { useState } from 'react';
import { useStore } from '../store';
import { Button, Input, Modal, Label } from '../components/ui';

export default function SubjectsList() {
  const { data, updateData } = useStore();
  const [newSubject, setNewSubject] = useState('');
  
  const [editingSubject, setEditingSubject] = useState<{ oldName: string, newName: string } | null>(null);

  const addSubject = () => {
    const val = newSubject.trim();
    if (!val) return;
    updateData(draft => {
      if (!draft.subjects.includes(val)) draft.subjects.push(val);
    });
    setNewSubject('');
  };
  
  const saveEdit = () => {
    if (!editingSubject) return;
    const val = editingSubject.newName.trim();
    if (!val) return;
    updateData(draft => {
      const idx = draft.subjects.indexOf(editingSubject.oldName);
      if (idx !== -1) {
        if (!draft.subjects.includes(val)) {
          draft.subjects[idx] = val;
        } else {
          // If the new name already exists, just remove the old one (merge)
          draft.subjects.splice(idx, 1);
        }
      }
    });
    setEditingSubject(null);
  };
  
  const deleteSubject = (subject: string) => {
    if (confirm(`Are you sure you want to delete "${subject}"? This won't affect past exams but removes it from the options.`)) {
      updateData(draft => {
        draft.subjects = draft.subjects.filter(s => s !== subject);
      });
    }
  };

  return (
    <>
      <div className="flex gap-2 mb-6">
        <Input 
          value={newSubject} 
          onChange={e => setNewSubject(e.target.value)} 
          placeholder="New Subject name" 
          className="max-w-[300px] mt-0"
          onKeyDown={e => e.key === 'Enter' && addSubject()}
        />
        <Button onClick={addSubject}>Add Subject</Button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[15px]">
        {data.subjects.map(s => (
          <div key={s} className="bg-[var(--card)] p-4 rounded-[var(--radius)] shadow-[var(--shadow)] flex flex-col justify-between group">
            <div className="font-bold mb-3">{s}</div>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="secondary" onClick={() => setEditingSubject({ oldName: s, newName: s })} className="flex-1 py-1 text-sm">Rename</Button>
              <Button variant="danger" onClick={() => deleteSubject(s)} className="flex-1 py-1 text-sm">Delete</Button>
            </div>
          </div>
        ))}
        {data.subjects.length === 0 && <p className="text-slate-500">No subjects added yet.</p>}
      </div>
      
      <Modal isOpen={!!editingSubject} onClose={() => setEditingSubject(null)}>
        <h2 className="text-xl font-bold mt-0 mb-4">Rename Subject</h2>
        <Label>Subject Name</Label>
        <Input 
          value={editingSubject?.newName || ''} 
          onChange={e => setEditingSubject(p => p ? { ...p, newName: e.target.value } : null)}
          onKeyDown={e => e.key === 'Enter' && saveEdit()}
        />
        <div className="flex gap-2 mt-4">
          <Button onClick={saveEdit}>Save</Button>
          <Button variant="secondary" onClick={() => setEditingSubject(null)}>Cancel</Button>
        </div>
      </Modal>
    </>
  );
}
