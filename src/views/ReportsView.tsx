import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Card, Input, Label, Select, Modal, Textarea } from '../components/ui';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function ReportsView() {
  const { data, config, branding, currentUser, currentRole, updateData } = useStore();
  const showToast = useToastStore(s => s.showToast);

  const teacherClasses = currentRole === 'teacher' ? (currentUser as any)?.classes || [] : [];
  const students = currentRole === 'teacher' 
    ? data.students.filter(s => teacherClasses.includes(s.class))
    : data.students;
  
  const [studentId, setStudentId] = useState(students[0]?.id || '');
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportKind, setReportKind] = useState<'academic' | 'afl'>('academic');
  
  const [reportForm, setReportForm] = useState<any>({});
  
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (students.length > 0 && !students.find(s => s.id === studentId)) {
      setStudentId(students[0].id);
    }
  }, [students, studentId]);

  const generateReport = (kind: 'academic' | 'afl') => {
    const s = data.students.find(x => x.id === studentId);
    if (!s) return;
    
    setReportKind(kind);
    const att = data.attendance.find(a => a.studentId === studentId) || { days: 0, present: 0, absent: 0, percent: 0 };
    
    setReportForm({
      term: s.reportTerm || 'Term 1',
      session: s.reportSession || '2026/2027',
      position: s.position || '',
      nextTerm: s.nextTerm || '',
      teacherName: s.teacherName || currentUser?.name || '',
      teacherComment: s.teacherComment || (kind === 'academic' ? 'Good performance. Keep improving.' : 'Keep working consistently.'),
      principalComment: s.principalComment || (kind === 'academic' ? 'We commend your effort and encourage continued excellence.' : 'We encourage continued progress.'),
      attDays: att.days,
      attPresent: att.present,
      attAbsent: att.absent,
      attPercent: att.percent
    });
    
    setIsReportOpen(true);
  };

  const saveReportDetails = () => {
    updateData(draft => {
      const s = draft.students.find(x => x.id === studentId);
      if (s) {
        s.reportTerm = reportForm.term;
        s.reportSession = reportForm.session;
        s.position = reportForm.position;
        s.nextTerm = reportForm.nextTerm;
        s.teacherName = reportForm.teacherName;
        s.teacherComment = reportForm.teacherComment;
        s.principalComment = reportForm.principalComment;
      }
      
      const days = Math.max(0, Number(reportForm.attDays) || 0);
      const present = Math.max(0, Number(reportForm.attPresent) || 0);
      if (present > days) {
        showToast('Days present cannot exceed school days');
        return;
      }
      
      draft.attendance = draft.attendance.filter(a => a.studentId !== studentId);
      draft.attendance.push({
        studentId,
        days,
        present,
        absent: days - present,
        percent: days ? Math.round((present / days) * 10000) / 100 : 0
      });
    });
    showToast('Report details saved');
  };

  const downloadPDF = () => {
    if (!reportRef.current) return;
    html2canvas(reportRef.current, { scale: 2, useCORS: true }).then(c => {
      const p = new jsPDF('p', 'mm', 'a4');
      const img = c.toDataURL('image/png');
      const w = 210;
      const h = c.height * 210 / c.width;
      if (h <= 297) {
        p.addImage(img, 'PNG', 0, 0, 210, h);
      } else {
        let y = 0;
        while (y < h) {
          p.addImage(img, 'PNG', 0, -y, 210, h);
          y += 297;
          if (y < h) p.addPage();
        }
      }
      p.save('EduCore_Report_Card.pdf');
    });
  };

  const s = data.students.find(x => x.id === studentId);
  
  const renderAcademicReport = () => {
    if (!s) return null;
    const official = data.results.filter(r => r.studentId === studentId && ['CA 1', 'CA 2', 'Examination'].includes(r.type));
    const by: Record<string, any> = {};
    
    official.forEach(r => {
      if (!by[r.subject]) by[r.subject] = { ca1: null, ca2: null, exam: null };
      
      const pct = r.rawMax > 0 ? (r.raw / r.rawMax) : 0;
      
      if (r.type === 'CA 1') by[r.subject].ca1 = Math.round(pct * config.ca1);
      if (r.type === 'CA 2') by[r.subject].ca2 = Math.round(pct * config.ca2);
      if (r.type === 'Examination') by[r.subject].exam = Math.round(pct * config.exam);
    });
    
    const rows = Object.keys(by).map(sub => {
      const x = by[sub];
      const total = (x.ca1 || 0) + (x.ca2 || 0) + (x.exam || 0);
      const g = config.grades.find(z => total >= z.min) || config.grades[config.grades.length - 1];
      return { sub, x, total, g };
    });
    
    const avg = rows.length ? rows.reduce((a, r) => a + r.total, 0) / rows.length : 0;
    const overallGrade = config.grades.find(z => avg >= z.min) || config.grades[config.grades.length - 1];
    
    const chartData = {
      labels: rows.map(x => x.sub),
      datasets: [{
        label: 'Performance %',
        data: rows.map(x => Math.max(0, Math.min(100, x.total))),
        backgroundColor: 'rgba(54, 162, 235, 0.5)'
      }]
    };
    
    return (
      <div ref={reportRef} className="w-[210mm] min-h-[297mm] mx-auto bg-white p-[14mm] text-[#111] overflow-hidden">
        <div className="text-center border-b-3 border-[var(--primary)] pb-2 mb-4">
          {branding.logo && <img className="w-[70px] h-[70px] object-cover rounded-full mx-auto" src={branding.logo} alt="Logo" />}
          <h1 className="text-2xl font-bold my-1">{branding.schoolName}</h1>
          <h3 className="text-lg my-1">{branding.motto}</h3>
          <p className="text-sm my-1">{branding.address} {branding.phone && ' · ' + branding.phone}</p>
          <h2 className="text-xl font-bold mt-4 mb-1">STUDENT REPORT CARD</h2>
          <p className="m-0"><b>{reportForm.term}</b> · {reportForm.session}</p>
        </div>
        
        <div className="flex justify-between items-start">
          <p>
            <b>Student:</b> {s.name} &nbsp; <b>Class:</b> {s.class} &nbsp; <b>ID:</b> {s.id} 
            {reportForm.position && <>&nbsp; <b>Position:</b> {reportForm.position}</>}
          </p>
          {s.photo && <img src={s.photo} className="w-[80px] h-[80px] object-cover -mt-10" alt="Student" />}
        </div>
        
        <table className="w-full border-collapse mt-4 text-[11px]">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-600 p-1.5 text-left">Subject</th>
              <th className="border border-slate-600 p-1.5 text-left">CA 1</th>
              <th className="border border-slate-600 p-1.5 text-left">CA 2</th>
              <th className="border border-slate-600 p-1.5 text-left">Examination</th>
              <th className="border border-slate-600 p-1.5 text-left">Total</th>
              <th className="border border-slate-600 p-1.5 text-left">Grade</th>
              <th className="border border-slate-600 p-1.5 text-left">Remark</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.sub}>
                <td className="border border-slate-600 p-1.5">{r.sub}</td>
                <td className="border border-slate-600 p-1.5">{r.x.ca1 ?? '-'}</td>
                <td className="border border-slate-600 p-1.5">{r.x.ca2 ?? '-'}</td>
                <td className="border border-slate-600 p-1.5">{r.x.exam ?? '-'}</td>
                <td className="border border-slate-600 p-1.5">{r.total}</td>
                <td className="border border-slate-600 p-1.5">{r.g.grade}</td>
                <td className="border border-slate-600 p-1.5">{r.g.remark}</td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="mt-4 border border-blue-100 rounded-xl p-2 bg-white">
          <h3 className="m-0 text-sm">Subject Performance Analysis</h3>
          <div className="h-[240px]">
            <Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { max: 100 } } }} />
          </div>
        </div>
        
        <h3 className="mt-4 mb-2">Overall Average: {avg.toFixed(2)}% · {overallGrade?.grade} ({overallGrade?.remark})</h3>
        
        <h3 className="mt-2 mb-1">Attendance</h3>
        <p className="m-0 mb-4">School Days: {reportForm.attDays} · Present: {reportForm.attPresent} · Absent: {reportForm.attAbsent} · Attendance: {reportForm.attPercent}%</p>
        
        <p><b>Class Teacher Comment:</b> {reportForm.teacherComment}</p>
        <p><b>Principal Comment:</b> {reportForm.principalComment}</p>
        
        <div className="flex justify-between mt-10 text-center">
          <div>____________________<br/>Class Teacher<br/>{reportForm.teacherName}</div>
          <div>____________________<br/>Principal<br/>{branding.principal}</div>
        </div>
      </div>
    );
  };

  const renderAflReport = () => {
    if (!s) return null;
    const afl = data.results.filter(r => r.studentId === studentId && (r.type === 'AFL' || ['Test', 'Quiz', 'Assignment', 'Mock', 'Other'].includes(r.type)));
    
    const getPct = (r: any) => r.rawMax > 0 ? Math.round((r.raw / r.rawMax) * 100) : 0;
    
    const avg = afl.length ? afl.reduce((a, r) => a + getPct(r), 0) / afl.length : 0;
    
    const bySubject = afl.reduce((m: any, r) => {
      (m[r.subject] = m[r.subject] || []).push(getPct(r));
      return m;
    }, {});
    
    const chartData = {
      labels: Object.keys(bySubject),
      datasets: [{
        label: 'Performance %',
        data: Object.values(bySubject).map((arr: any) => arr.reduce((a: number,b: number) => a+b, 0) / arr.length),
        backgroundColor: 'rgba(16, 185, 129, 0.5)'
      }]
    };
    
    return (
      <div ref={reportRef} className="w-[210mm] min-h-[297mm] mx-auto bg-white p-[14mm] text-[#111] overflow-hidden">
        <div className="text-center border-b-3 border-[var(--primary)] pb-2 mb-4">
          {branding.logo && <img className="w-[70px] h-[70px] object-cover rounded-full mx-auto" src={branding.logo} alt="Logo" />}
          <h1 className="text-2xl font-bold my-1">{branding.schoolName}</h1>
          <h3 className="text-lg my-1">{branding.motto}</h3>
          <p className="text-sm my-1">{branding.address}</p>
          <h2 className="text-xl font-bold mt-4 mb-1">AFL / FORMATIVE ASSESSMENT REPORT CARD</h2>
          <p className="m-0"><b>{reportForm.term}</b> · {reportForm.session}</p>
        </div>
        
        <p><b>Student:</b> {s.name} &nbsp; <b>Class:</b> {s.class} &nbsp; <b>ID:</b> {s.id}</p>
        
        <table className="w-full border-collapse mt-4 text-[11px]">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-600 p-1.5 text-left">Date</th>
              <th className="border border-slate-600 p-1.5 text-left">Subject</th>
              <th className="border border-slate-600 p-1.5 text-left">Assessment</th>
              <th className="border border-slate-600 p-1.5 text-left">Score</th>
              <th className="border border-slate-600 p-1.5 text-left">Percentage</th>
              <th className="border border-slate-600 p-1.5 text-left">Grade</th>
            </tr>
          </thead>
          <tbody>
            {afl.map(r => {
              const pct = getPct(r);
              const g = config.grades.find(z => pct >= z.min) || config.grades[config.grades.length - 1];
              return (
                <tr key={r.id}>
                  <td className="border border-slate-600 p-1.5">{new Date(r.submittedAt).toLocaleDateString()}</td>
                  <td className="border border-slate-600 p-1.5">{r.subject}</td>
                  <td className="border border-slate-600 p-1.5">{r.type}</td>
                  <td className="border border-slate-600 p-1.5">{r.raw}/{r.rawMax}</td>
                  <td className="border border-slate-600 p-1.5">{pct}%</td>
                  <td className="border border-slate-600 p-1.5">{g?.grade}</td>
                </tr>
              );
            })}
            {afl.length === 0 && (
              <tr><td colSpan={6} className="border border-slate-600 p-1.5 text-center">No AFL assessments recorded.</td></tr>
            )}
          </tbody>
        </table>
        
        <div className="mt-4 border border-blue-100 rounded-xl p-2 bg-white">
          <h3 className="m-0 text-sm">AFL Subject Performance Analysis</h3>
          <div className="h-[240px]">
            <Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { max: 100 } } }} />
          </div>
        </div>
        
        <h3 className="mt-4 mb-2">AFL Average: {avg.toFixed(2)}%</h3>
        
        <h3 className="mt-2 mb-1">Attendance</h3>
        <p className="m-0 mb-4">School Days: {reportForm.attDays} · Present: {reportForm.attPresent} · Absent: {reportForm.attAbsent} · Attendance: {reportForm.attPercent}%</p>
        
        <p><b>Teacher Comment:</b> {reportForm.teacherComment}</p>
        <p><b>Principal Comment:</b> {reportForm.principalComment}</p>
        
        <div className="flex justify-between mt-10 text-center">
          <div>____________________<br/>Class Teacher<br/>{reportForm.teacherName}</div>
          <div>____________________<br/>Principal<br/>{branding.principal}</div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Card>
        <h3 className="mt-0 text-xl font-bold">Generate Report Card</h3>
        <p className="text-slate-500 mb-4">Generate the academic report or a dedicated AFL progress report.</p>
        
        <Select value={studentId} onChange={e => setStudentId(e.target.value)}>
          {data.students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.class})</option>)}
        </Select>
        
        <div className="flex gap-2 mt-4">
          <Button onClick={() => generateReport('academic')}>Academic Report</Button>
          <Button variant="secondary" onClick={() => generateReport('afl')}>AFL Report Card</Button>
        </div>
      </Card>
      
      <Modal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)}>
        <div className="max-w-[1100px] w-full">
          <Card className="mb-3">
            <h3 className="mt-0">{reportKind === 'academic' ? 'Report Card Details' : 'AFL Report Card Details'} — {s?.name}</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div><Label>Term</Label><Input value={reportForm.term} onChange={e => setReportForm((p: any) => ({ ...p, term: e.target.value }))} /></div>
              <div><Label>Session</Label><Input value={reportForm.session} onChange={e => setReportForm((p: any) => ({ ...p, session: e.target.value }))} /></div>
              {reportKind === 'academic' && (
                <>
                  <div><Label>Position</Label><Input value={reportForm.position} onChange={e => setReportForm((p: any) => ({ ...p, position: e.target.value }))} /></div>
                  <div><Label>Next Term</Label><Input value={reportForm.nextTerm} onChange={e => setReportForm((p: any) => ({ ...p, nextTerm: e.target.value }))} /></div>
                </>
              )}
              <div><Label>Teacher Name</Label><Input value={reportForm.teacherName} onChange={e => setReportForm((p: any) => ({ ...p, teacherName: e.target.value }))} /></div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <div><Label>School Days</Label><Input type="number" value={reportForm.attDays} onChange={e => setReportForm((p: any) => ({ ...p, attDays: e.target.value }))} /></div>
              <div><Label>Days Present</Label><Input type="number" value={reportForm.attPresent} onChange={e => setReportForm((p: any) => ({ ...p, attPresent: e.target.value }))} /></div>
              <div><Label>Days Absent</Label><Input type="number" value={reportForm.attAbsent} onChange={e => setReportForm((p: any) => ({ ...p, attAbsent: e.target.value }))} /></div>
              <div><Label>Attendance %</Label><Input type="number" value={reportForm.attPercent} onChange={e => setReportForm((p: any) => ({ ...p, attPercent: e.target.value }))} /></div>
            </div>
            
            <Label>Teacher Comment</Label>
            <Textarea rows={3} value={reportForm.teacherComment} onChange={e => setReportForm((p: any) => ({ ...p, teacherComment: e.target.value }))} />
            
            <Label>Principal Comment</Label>
            <Textarea rows={3} value={reportForm.principalComment} onChange={e => setReportForm((p: any) => ({ ...p, principalComment: e.target.value }))} />
          </Card>
          
          <div className="overflow-auto bg-slate-200 p-4 rounded-[14px]">
            {reportKind === 'academic' ? renderAcademicReport() : renderAflReport()}
          </div>
          
          <div className="flex justify-center gap-2 mt-4">
            <Button variant="success" onClick={saveReportDetails}>Save Report Details</Button>
            <Button onClick={downloadPDF}>Download PDF</Button>
            <Button variant="secondary" onClick={() => setIsReportOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
