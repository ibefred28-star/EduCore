import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Card, Input, Label, Select } from '../components/ui';
import { isStudentInTeacherClasses } from '../lib/classUtils';

export default function AttendanceView() {
  const { data, updateData, currentUser, currentRole } = useStore();
  const showToast = useToastStore(s => s.showToast);

  const teacher = currentRole === 'teacher' 
    ? data.teachers.find(t => (t.id || '').trim().toLowerCase() === (currentUser?.id || '').trim().toLowerCase()) || (currentUser as any)
    : null;
  const teacherClasses = teacher?.classes || [];

  const students = currentRole === 'teacher' 
    ? data.students.filter(s => isStudentInTeacherClasses(s.class, teacherClasses))
    : data.students;
  
  const [studentId, setStudentId] = useState(students[0]?.id || '');
  const [days, setDays] = useState(0);
  const [present, setPresent] = useState(0);

  useEffect(() => {
    if (students.length > 0 && !students.find(s => s.id === studentId)) {
      setStudentId(students[0].id);
    }
  }, [students, studentId]);

  useEffect(() => {
    if (!studentId) return;
    const existing = data.attendance.find(a => a.studentId === studentId);
    if (existing) {
      setDays(existing.days);
      setPresent(existing.present);
    } else {
      setDays(60);
      setPresent(60);
    }
  }, [studentId]);

  const saveAttendance = () => {
    if (days < 0 || present < 0 || present > days) return showToast('Present days cannot exceed school days');
    
    updateData(draft => {
      draft.attendance = draft.attendance.filter(x => x.studentId !== studentId);
      draft.attendance.push({
        studentId,
        days,
        present,
        absent: days - present,
        percent: days ? Math.round((present / days) * 10000) / 100 : 0
      });
    });
    showToast('Attendance saved');
  };

  return (
    <>
      <Card className="mb-4">
        <h3 className="m-0 text-xl font-bold">Attendance</h3>
        
        <Label>Student</Label>
        <Select value={studentId} onChange={e => setStudentId(e.target.value)}>
          {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.class})</option>)}
        </Select>
        {students.length === 0 && (
          <p className="text-sm text-amber-600 mt-2">
            No students found registered for your assigned class ({teacherClasses.join(', ') || 'No classes assigned'}).
          </p>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <div>
            <Label className="mt-0">Total School Days</Label>
            <Input type="number" min="0" value={days} onChange={e => setDays(Math.max(0, Number(e.target.value)))} />
          </div>
          <div>
            <Label className="mt-0">Days Present</Label>
            <Input type="number" min="0" value={present} onChange={e => setPresent(Math.max(0, Number(e.target.value)))} />
          </div>
          <div>
            <Label className="mt-0 flex items-center justify-between">
              <span>Days Absent</span>
              <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">Auto</span>
            </Label>
            <Input 
              type="number" 
              readOnly 
              className="bg-slate-100 text-rose-700 font-bold cursor-default select-all" 
              value={Math.max(0, days - present)} 
            />
          </div>
          <div>
            <Label className="mt-0 flex items-center justify-between">
              <span>Attendance %</span>
              <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">Auto</span>
            </Label>
            <Input 
              type="number" 
              readOnly 
              className="bg-slate-100 text-blue-700 font-bold cursor-default select-all" 
              value={days > 0 ? Math.round((present / days) * 1000) / 10 : 0} 
            />
          </div>
        </div>
        
        <Button className="mt-4" onClick={saveAttendance}>Save Attendance</Button>
      </Card>

      <div className="overflow-x-auto bg-white rounded-lg shadow border border-slate-200">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left">
              <th className="p-3 font-semibold">Student</th>
              <th className="p-3 font-semibold">Days</th>
              <th className="p-3 font-semibold">Present</th>
              <th className="p-3 font-semibold">Absent</th>
              <th className="p-3 font-semibold">%</th>
            </tr>
          </thead>
          <tbody>
            {data.attendance.filter(a => students.some(s => s.id === a.studentId)).map(a => {
              const s = students.find(x => x.id === a.studentId);
              return (
                <tr key={a.studentId} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                  <td className="p-3">{s?.name || a.studentId}</td>
                  <td className="p-3">{a.days}</td>
                  <td className="p-3">{a.present}</td>
                  <td className="p-3">{a.absent}</td>
                  <td className="p-3">{a.percent}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
