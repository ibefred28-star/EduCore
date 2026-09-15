import { useState } from 'react';
import { useStore } from '../store';
import { Button, Input } from '../components/ui';

export default function SubjectsList() {
  const { data, updateData } = useStore();
  const [newSubject, setNewSubject] = useState('');

  const addSubject = () => {
    const val = newSubject.trim();
    if (!val) return;
    updateData(draft => {
      if (!draft.subjects.includes(val)) draft.subjects.push(val);
    });
    setNewSubject('');
  };

  return (
    <>
      <div className="flex gap-2 mb-4">
        <Input 
          value={newSubject} 
          onChange={e => setNewSubject(e.target.value)} 
          placeholder="Subject name" 
          className="max-w-[300px] mt-0"
          onKeyDown={e => e.key === 'Enter' && addSubject()}
        />
        <Button onClick={addSubject}>Add Subject</Button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[15px]">
        {data.subjects.map(s => (
          <div key={s} className="bg-[var(--card)] p-[18px] rounded-[var(--radius)] shadow-[var(--shadow)] font-bold">
            {s}
          </div>
        ))}
      </div>
    </>
  );
}
