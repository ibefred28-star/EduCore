import { useState } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Card, Input, Label, Select } from '../components/ui';

export default function AttendanceView() {
  const { data, updateData } = useStore();
  const showToast = useToastStore(s => s.showToast);
  
  const [studentId, setStudentId] = useState(data.students[0]?.id || '');
  const [days, setDays] = useState(0);
  const [present, setPresent] = useState(0);

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
          {data.students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        
        <Label>Total school days</Label>
        <Input type="number" min="0" value={days} onChange={e => setDays(Number(e.target.value))} />
        
        <Label>Days present</Label>
        <Input type="number" min="0" value={present} onChange={e => setPresent(Number(e.target.value))} />
        
        <Button className="mt-[10px]" onClick={saveAttendance}>Save Attendance</Button>
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
            {data.attendance.map(a => {
              const s = data.students.find(x => x.id === a.studentId);
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
