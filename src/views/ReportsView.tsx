import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Card, Input, Label, Select, Modal, Textarea } from '../components/ui';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { isStudentInTeacherClasses } from '../lib/classUtils';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function ReportsView() {
  const { data, config, branding, currentUser, currentRole, updateData } = useStore();
  const showToast = useToastStore(s => s.showToast);

  const teacher = currentRole === 'teacher' 
    ? data.teachers.find(t => (t.id || '').trim().toLowerCase() === (currentUser?.id || '').trim().toLowerCase()) || (currentUser as any)
    : null;
  const teacherClasses = teacher?.classes || [];

  const students = currentRole === 'teacher' 
    ? data.students.filter(s => isStudentInTeacherClasses(s.class, teacherClasses))
    : data.students;
  
  const [studentId, setStudentId] = useState(students[0]?.id || '');
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportKind, setReportKind] = useState<'academic' | 'afl'>('academic');
  
  const [reportForm, setReportForm] = useState<any>({});
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
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
    const initialDays = Number(att.days) || 0;
    const initialPresent = Number(att.present) || 0;
    const initialAbsent = Math.max(0, initialDays - initialPresent);
    const initialPercent = initialDays > 0 ? Math.round((initialPresent / initialDays) * 1000) / 10 : 0;
    
    setReportForm({
      term: s.reportTerm || 'First Term',
      session: s.reportSession || '2026/2027',
      position: s.position || '',
      nextTerm: s.nextTerm || '',
      teacherName: s.teacherName || currentUser?.name || '',
      teacherComment: s.teacherComment || (kind === 'academic' ? 'Good performance. Keep improving.' : 'Keep working consistently.'),
      principalComment: s.principalComment || (kind === 'academic' ? 'We commend your effort and encourage continued excellence.' : 'We encourage continued progress.'),
      teacherSignature: s.teacherSignature || '',
      principalSignature: s.principalSignature || '',
      attDays: initialDays || '',
      attPresent: initialPresent || '',
      attAbsent: initialAbsent,
      attPercent: initialPercent
    });
    
    setIsReportOpen(true);
  };

  const handleAttendanceChange = (field: 'attDays' | 'attPresent', val: string) => {
    setReportForm((prev: any) => {
      const nextDaysStr = field === 'attDays' ? val : String(prev.attDays ?? '');
      const nextPresentStr = field === 'attPresent' ? val : String(prev.attPresent ?? '');

      const d = nextDaysStr === '' ? 0 : Math.max(0, Number(nextDaysStr) || 0);
      const p = nextPresentStr === '' ? 0 : Math.max(0, Number(nextPresentStr) || 0);

      // Automatically calculate days absent and percentage present
      const absent = Math.max(0, d - p);
      const percent = d > 0 ? Math.round((p / d) * 1000) / 10 : 0;

      return {
        ...prev,
        [field]: val,
        attAbsent: absent,
        attPercent: percent
      };
    });
  };

  useEffect(() => {
    if (isReportOpen) {
      const timer = setTimeout(() => {
        saveReportDetails(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [reportForm, isReportOpen]);

  const saveReportDetails = (silent = false) => {
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
        s.teacherSignature = reportForm.teacherSignature;
        s.principalSignature = reportForm.principalSignature;
      }
      
      const days = Math.max(0, Number(reportForm.attDays) || 0);
      const present = Math.max(0, Number(reportForm.attPresent) || 0);
      if (present > days) {
        if (!silent) showToast('Days present cannot exceed school days opened');
        return;
      }
      
      draft.attendance = draft.attendance.filter(a => a.studentId !== studentId);
      draft.attendance.push({
        studentId,
        days,
        present,
        absent: Math.max(0, days - present),
        percent: days ? Math.round((present / days) * 1000) / 10 : 0
      });
    });
    if (!silent) showToast('Report details saved');
  };

  const getGradeBadge = (grade: string) => {
    const g = (grade || '').toUpperCase().trim();
    if (g === 'A' || g === 'A+') return 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300';
    if (g === 'B') return 'bg-blue-100 text-blue-800 font-bold border border-blue-300';
    if (g === 'C') return 'bg-amber-100 text-amber-800 font-bold border border-amber-300';
    if (g === 'D') return 'bg-orange-100 text-orange-800 font-bold border border-orange-300';
    return 'bg-rose-100 text-rose-800 font-bold border border-rose-300';
  };

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPdf(true);
    try {
      // 1. Wait for all images inside report card to be fully loaded (school logo, signatures, student photo)
      const images = Array.from(reportRef.current.querySelectorAll('img')) as HTMLImageElement[];
      await Promise.all(
        images.map((img: HTMLImageElement) => {
          if (img.complete) return Promise.resolve();
          return new Promise(res => {
            img.onload = res;
            img.onerror = res;
          });
        })
      );

      // 2. Allow render tree and Chart.js canvas to settle completely
      await new Promise(res => setTimeout(res, 250));

      // 3. High-definition rasterization matching exact 794px A4 element width (~288 DPI)
      const element = reportRef.current;
      const elementWidth = 794;
      const elementHeight = element.scrollHeight;

      const c = await html2canvas(element, {
        scale: 3, // 3x scale (~288 DPI) for razor-sharp typography, lines, and chart rendering
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: elementWidth,
        height: elementHeight,
        windowWidth: elementWidth,
      });

      // 4. Create jsPDF in portrait A4 (210 x 297 mm) with compression enabled
      const p = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      // 5. Use lossless PNG so all text, numbers, badges, and table lines are 100% crisp without JPEG blur
      const img = c.toDataURL('image/png');
      const w = 210;
      const pageH = 297;
      const renderedH = (c.height * w) / c.width;

      // If document fits within 1 page (or with slight tolerance up to 304mm), map precisely to 1 single A4 page
      if (renderedH <= pageH + 7) {
        p.addImage(img, 'PNG', 0, 0, w, pageH, undefined, 'FAST');
      } else {
        // Multi-page pagination
        let y = 0;
        while (y < renderedH) {
          p.addImage(img, 'PNG', 0, -y, w, renderedH, undefined, 'FAST');
          y += pageH;
          if (y < renderedH) p.addPage();
        }
      }

      const safeName = (s?.name || 'Student').replace(/[^a-zA-Z0-9_-]/g, '_');
      p.save(`Report_Card_${safeName}.pdf`);
      showToast('High-quality report card downloaded successfully');
    } catch (err) {
      console.error('Error generating report card PDF:', err);
      showToast('Could not generate PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
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
        label: 'Overall Examination Score (%)',
        data: rows.map(x => Math.max(0, Math.min(100, x.total))),
        backgroundColor: branding.primary ? `${branding.primary}cc` : 'rgba(37, 99, 235, 0.75)',
        borderColor: branding.primary || '#2563eb',
        borderWidth: 1.5,
        borderRadius: 4
      }]
    };
    
    return (
      <div 
        ref={reportRef} 
        style={{ width: '794px', minHeight: '1123px', boxSizing: 'border-box' }}
        className="w-[794px] min-h-[1123px] mx-auto bg-white p-7 text-slate-800 text-[11.5px] leading-snug flex flex-col justify-between font-sans box-border shadow-xs"
      >
        <div>
          {/* Official School Letterhead */}
          <div className="flex items-center justify-between pb-3 border-b-2" style={{ borderColor: branding.primary || '#2563eb' }}>
            <div className="w-[72px] h-[72px] flex items-center justify-center shrink-0">
              {branding.logo ? (
                <img className="max-w-[72px] max-h-[72px] object-contain rounded-full border border-slate-200 shadow-xs" src={branding.logo} alt="School Logo" crossOrigin="anonymous" />
              ) : (
                <div className="w-[64px] h-[64px] rounded-full flex items-center justify-center text-white font-bold text-xl shadow-xs" style={{ backgroundColor: branding.primary || '#2563eb' }}>
                  {branding.schoolName?.charAt(0) || 'E'}
                </div>
              )}
            </div>

            <div className="text-center flex-1 px-3">
              <h1 className="text-xl font-black uppercase tracking-tight text-slate-900 m-0">{branding.schoolName}</h1>
              <p className="text-xs italic font-medium text-slate-600 mt-0.5 mb-1">{branding.motto || 'Knowledge, Discipline & Excellence'}</p>
              <p className="text-[10px] text-slate-500 m-0">
                {branding.address} {branding.phone ? `· Tel: ${branding.phone}` : ''}
              </p>
            </div>

            <div className="w-[72px] flex flex-col items-center justify-center text-right shrink-0">
              <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-400">Official</span>
              <span className="text-[10px] font-bold text-slate-700">TRANSCRIPT</span>
              <div className="w-9 h-1 rounded-full mt-1" style={{ backgroundColor: branding.primary || '#2563eb' }} />
            </div>
          </div>

          {/* Document Title Banner */}
          <div className="text-center my-2.5 py-1 px-3 rounded-md bg-slate-100 flex items-center justify-between border border-slate-200">
            <span className="text-xs font-black uppercase tracking-wider text-slate-800">
              Official Terminal Student Report Card
            </span>
            <span className="text-[11px] font-semibold text-slate-600">
              {reportForm.term} · {reportForm.session} Academic Session
            </span>
          </div>

          {/* Student Profile Card */}
          <div className="grid grid-cols-12 gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5 mb-2.5">
            <div className="col-span-10 grid grid-cols-3 gap-y-1.5 gap-x-2 text-[11px]">
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Student Name</span>
                <span className="font-bold text-slate-900 text-xs">{s.name}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Student ID / Reg No</span>
                <span className="font-semibold text-slate-800">{s.id}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Class</span>
                <span className="font-semibold text-slate-800">{s.class}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Class Position</span>
                <span className="font-semibold text-slate-800">{reportForm.position || '—'}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Academic Term</span>
                <span className="font-semibold text-slate-800">{reportForm.term}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Academic Session</span>
                <span className="font-semibold text-slate-800">{reportForm.session}</span>
              </div>
            </div>

            <div className="col-span-2 flex items-center justify-center border-l border-slate-200 pl-2">
              {s.photo ? (
                <img src={s.photo} className="w-[66px] h-[66px] object-cover rounded-md border border-slate-300 shadow-2xs" alt="Student" crossOrigin="anonymous" />
              ) : (
                <div className="w-[62px] h-[62px] rounded-md bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-400 text-xs font-semibold">
                  Photo
                </div>
              )}
            </div>
          </div>

          {/* Attendance Summary - Directly Beneath Student & Term Information */}
          <div className="mb-3 bg-slate-50/90 border border-slate-200 rounded-lg p-2.5">
            <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-200">
              <span className="text-[9.5px] uppercase font-bold tracking-wider text-slate-600">
                Attendance & Session Summary
              </span>
              <span className="text-[9.5px] text-slate-500 font-medium">
                Academic Term: <b className="text-slate-700">{reportForm.term}</b> · Session: <b className="text-slate-700">{reportForm.session}</b>
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2 text-center">
              <div className="bg-white p-1.5 rounded border border-slate-200 shadow-2xs">
                <span className="text-[8.5px] uppercase font-bold text-slate-400 block tracking-wider">School Days (Opened)</span>
                <span className="text-sm font-extrabold text-slate-800">{reportForm.attDays || 0}</span>
              </div>
              <div className="bg-white p-1.5 rounded border border-slate-200 shadow-2xs">
                <span className="text-[8.5px] uppercase font-bold text-slate-400 block tracking-wider">Days Present</span>
                <span className="text-sm font-extrabold text-emerald-700">{reportForm.attPresent || 0}</span>
              </div>
              <div className="bg-white p-1.5 rounded border border-slate-200 shadow-2xs">
                <span className="text-[8.5px] uppercase font-bold text-slate-400 block tracking-wider">Days Absent</span>
                <span className="text-sm font-extrabold text-rose-700">{reportForm.attAbsent || 0}</span>
              </div>
              <div className="bg-white p-1.5 rounded border border-slate-200 shadow-2xs">
                <span className="text-[8.5px] uppercase font-bold text-slate-400 block tracking-wider">Attendance Rate</span>
                <span className="text-sm font-extrabold text-blue-700">{reportForm.attPercent || 0}%</span>
              </div>
              <div className="bg-white p-1.5 rounded border border-slate-200 shadow-2xs flex flex-col justify-center">
                <span className="text-[8.5px] uppercase font-bold text-slate-400 block tracking-wider">Next Term Resumes</span>
                <span className="text-[11px] font-bold text-slate-800 truncate px-0.5">{reportForm.nextTerm || 'To be communicated'}</span>
              </div>
            </div>
          </div>

          {/* Academic Performance Table */}
          <div className="border border-slate-300 rounded-lg overflow-hidden mb-3">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                  <th className="p-2 text-left">Subject</th>
                  <th className="p-2 text-center w-[12%]">CA 1 ({config.ca1})</th>
                  <th className="p-2 text-center w-[12%]">CA 2 ({config.ca2})</th>
                  <th className="p-2 text-center w-[16%]">Exam ({config.exam})</th>
                  <th className="p-2 text-center w-[13%]">Total (100)</th>
                  <th className="p-2 text-center w-[11%]">Grade</th>
                  <th className="p-2 text-left w-[18%]">Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((r, i) => (
                  <tr key={r.sub} className={i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                    <td className="p-1.5 px-2 font-medium text-slate-900">{r.sub}</td>
                    <td className="p-1.5 text-center text-slate-700">{r.x.ca1 ?? '-'}</td>
                    <td className="p-1.5 text-center text-slate-700">{r.x.ca2 ?? '-'}</td>
                    <td className="p-1.5 text-center text-slate-700">{r.x.exam ?? '-'}</td>
                    <td className="p-1.5 text-center font-bold text-slate-900">{r.total}</td>
                    <td className="p-1.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${getGradeBadge(r.g.grade)}`}>
                        {r.g.grade}
                      </span>
                    </td>
                    <td className="p-1.5 px-2 text-slate-600 text-[10.5px]">{r.g.remark}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-3 text-center text-slate-500">No examination results recorded for this term.</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900 border-t border-slate-300 text-[11px]">
                  <td className="p-2" colSpan={4}>
                    <span className="uppercase tracking-wider text-[10px] text-slate-500 mr-2">Overall Performance:</span>
                    {rows.length} Subjects Evaluated
                  </td>
                  <td className="p-2 text-center text-blue-700 font-extrabold">{avg.toFixed(1)}%</td>
                  <td className="p-2 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${getGradeBadge(overallGrade?.grade)}`}>
                      {overallGrade?.grade}
                    </span>
                  </td>
                  <td className="p-2 text-slate-700 text-[10.5px]">{overallGrade?.remark}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Performance Chart - Measured over 100 for examinations */}
          <div className="border border-slate-200 rounded-lg p-2.5 bg-white mb-3 shadow-2xs">
            <div className="flex items-center justify-between mb-1">
              <h4 className="m-0 text-[10.5px] font-bold uppercase tracking-wider text-slate-700">Subject Examination Performance Analysis</h4>
              <span className="text-[9.5px] text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded">
                Measured over 100
              </span>
            </div>
            <div className="h-[135px]">
              <Bar 
                data={chartData} 
                options={{ 
                  responsive: true, 
                  maintainAspectRatio: false, 
                  animation: false,
                  plugins: { 
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (ctx) => `Score: ${ctx.raw}%`
                      }
                    }
                  }, 
                  scales: { 
                    y: { 
                      max: 100, 
                      min: 0, 
                      ticks: { 
                        stepSize: 20, 
                        font: { size: 9 },
                        callback: (val: any) => `${val}%`
                      },
                      title: {
                        display: true,
                        text: 'Score (out of 100)',
                        font: { size: 9, weight: 'bold' }
                      }
                    },
                    x: { ticks: { font: { size: 9.5 } } }
                  } 
                }} 
              />
            </div>
          </div>

          {/* Teacher & Principal Remarks */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="border border-slate-200 rounded-lg p-2.5 bg-white">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-1">Class Teacher's Appraisal</span>
              <p className="text-[10.5px] text-slate-700 italic m-0 min-h-[30px]">
                "{reportForm.teacherComment || 'Satisfactory academic performance and steady progress shown throughout the term.'}"
              </p>
            </div>
            <div className="border border-slate-200 rounded-lg p-2.5 bg-white">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-1">Principal's Appraisal</span>
              <p className="text-[10.5px] text-slate-700 italic m-0 min-h-[30px]">
                "{reportForm.principalComment || 'Good academic standing. Continued focus, discipline, and hard work are highly encouraged.'}"
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Section: Grading Scale, Signatures & Stamp */}
        <div>
          {/* Grading Scale Legend */}
          <div className="py-1 px-2.5 mb-2.5 bg-slate-100 rounded text-[9.5px] text-slate-600 flex justify-between items-center border border-slate-200">
            <span className="font-bold uppercase tracking-wider text-slate-700">Grading Key:</span>
            {config.grades.map(g => (
              <span key={g.grade}>
                <b className="text-slate-800">{g.grade}</b> ({g.min}%+) {g.remark}
              </span>
            ))}
          </div>

          {/* Official Signatures and Seal */}
          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-300 text-center items-end">
            <div className="flex flex-col items-center">
              {reportForm.teacherSignature ? (
                <img src={reportForm.teacherSignature} alt="Teacher Signature" className="h-10 object-contain mb-1" crossOrigin="anonymous" />
              ) : (
                <div className="h-10 border-b border-dashed border-slate-300 w-36 mb-1" />
              )}
              <div className="text-[10px] text-slate-800 font-bold">{reportForm.teacherName || 'Class Teacher'}</div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">Class Teacher</div>
            </div>

            <div className="flex flex-col items-center justify-center">
              <div className="w-13 h-13 rounded-full border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 mb-1">
                <span className="text-[7px] uppercase font-black tracking-widest text-center leading-tight">OFFICIAL<br/>SEAL</span>
              </div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">EduCore Verified</div>
            </div>

            <div className="flex flex-col items-center">
              {reportForm.principalSignature ? (
                <img src={reportForm.principalSignature} alt="Principal Signature" className="h-10 object-contain mb-1" crossOrigin="anonymous" />
              ) : (
                <div className="h-10 border-b border-dashed border-slate-300 w-36 mb-1" />
              )}
              <div className="text-[10px] text-slate-800 font-bold">{branding.principal || 'Principal'}</div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">Principal / Head of School</div>
            </div>
          </div>

          <div className="mt-2 pt-1 border-t border-slate-100 text-[8.5px] text-slate-400 flex justify-between items-center">
            <span>Official Computer-Generated Academic Transcript · Generated via EduCore Portal</span>
            <span>Date Issued: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderAflReport = () => {
    if (!s) return null;
    const afl = data.results.filter(r => r.studentId === studentId && (r.type === 'AFL' || ['Test', 'Quiz', 'Assignment', 'Mock', 'Other'].includes(r.type)));
    
    const getPct = (r: any) => r.rawMax > 0 ? Math.round((r.raw / r.rawMax) * 100) : 0;
    const getScore10 = (r: any) => r.rawMax > 0 ? Math.round((r.raw / r.rawMax) * 100) / 10 : 0;
    
    const avg = afl.length ? afl.reduce((a, r) => a + getPct(r), 0) / afl.length : 0;
    const avg10 = afl.length ? Math.round((avg / 10) * 10) / 10 : 0;
    
    const bySubject = afl.reduce((m: any, r) => {
      (m[r.subject] = m[r.subject] || []).push(getScore10(r));
      return m;
    }, {});
    
    const chartData = {
      labels: Object.keys(bySubject),
      datasets: [{
        label: 'AFL Score (out of 10)',
        data: Object.values(bySubject).map((arr: any) => Math.round((arr.reduce((a: number, b: number) => a + b, 0) / arr.length) * 10) / 10),
        backgroundColor: 'rgba(16, 185, 129, 0.75)',
        borderColor: '#10b981',
        borderWidth: 1.5,
        borderRadius: 4
      }]
    };
    
    return (
      <div 
        ref={reportRef} 
        style={{ width: '794px', minHeight: '1123px', boxSizing: 'border-box' }}
        className="w-[794px] min-h-[1123px] mx-auto bg-white p-7 text-slate-800 text-[11.5px] leading-snug flex flex-col justify-between font-sans box-border shadow-xs"
      >
        <div>
          {/* Official School Letterhead */}
          <div className="flex items-center justify-between pb-3 border-b-2" style={{ borderColor: branding.primary || '#10b981' }}>
            <div className="w-[72px] h-[72px] flex items-center justify-center shrink-0">
              {branding.logo ? (
                <img className="max-w-[72px] max-h-[72px] object-contain rounded-full border border-slate-200 shadow-xs" src={branding.logo} alt="School Logo" crossOrigin="anonymous" />
              ) : (
                <div className="w-[64px] h-[64px] rounded-full flex items-center justify-center text-white font-bold text-xl shadow-xs" style={{ backgroundColor: branding.primary || '#10b981' }}>
                  {branding.schoolName?.charAt(0) || 'E'}
                </div>
              )}
            </div>

            <div className="text-center flex-1 px-3">
              <h1 className="text-xl font-black uppercase tracking-tight text-slate-900 m-0">{branding.schoolName}</h1>
              <p className="text-xs italic font-medium text-slate-600 mt-0.5 mb-1">{branding.motto || 'Knowledge, Discipline & Excellence'}</p>
              <p className="text-[10px] text-slate-500 m-0">
                {branding.address} {branding.phone ? `· Tel: ${branding.phone}` : ''}
              </p>
            </div>

            <div className="w-[72px] flex flex-col items-center justify-center text-right shrink-0">
              <span className="text-[9px] uppercase tracking-wider font-semibold text-emerald-600">Formative</span>
              <span className="text-[10px] font-bold text-slate-700">AFL REPORT</span>
              <div className="w-9 h-1 rounded-full mt-1 bg-emerald-500" />
            </div>
          </div>

          {/* Document Title Banner */}
          <div className="text-center my-2.5 py-1 px-3 rounded-md bg-emerald-50 flex items-center justify-between border border-emerald-200">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-900">
              AFL / Formative Continuous Assessment Report
            </span>
            <span className="text-[11px] font-semibold text-emerald-800">
              {reportForm.term} · {reportForm.session} Academic Session
            </span>
          </div>

          {/* Student Profile Card */}
          <div className="grid grid-cols-12 gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5 mb-2.5">
            <div className="col-span-10 grid grid-cols-3 gap-y-1.5 gap-x-2 text-[11px]">
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Student Name</span>
                <span className="font-bold text-slate-900 text-xs">{s.name}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Student ID / Reg No</span>
                <span className="font-semibold text-slate-800">{s.id}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Class</span>
                <span className="font-semibold text-slate-800">{s.class}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">AFL Assessments</span>
                <span className="font-semibold text-slate-800">{afl.length} Recorded</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Academic Term</span>
                <span className="font-semibold text-slate-800">{reportForm.term}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Academic Session</span>
                <span className="font-semibold text-slate-800">{reportForm.session}</span>
              </div>
            </div>

            <div className="col-span-2 flex items-center justify-center border-l border-slate-200 pl-2">
              {s.photo ? (
                <img src={s.photo} className="w-[66px] h-[66px] object-cover rounded-md border border-slate-300 shadow-2xs" alt="Student" crossOrigin="anonymous" />
              ) : (
                <div className="w-[62px] h-[62px] rounded-md bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-400 text-xs font-semibold">
                  Photo
                </div>
              )}
            </div>
          </div>

          {/* Attendance Summary - Directly Beneath Student & Term Information */}
          <div className="mb-3 bg-emerald-50/70 border border-emerald-200 rounded-lg p-2.5">
            <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-emerald-200/80">
              <span className="text-[9.5px] uppercase font-bold tracking-wider text-emerald-800">
                Attendance & Assessment Summary
              </span>
              <span className="text-[9.5px] text-emerald-700 font-medium">
                Academic Term: <b className="text-emerald-900">{reportForm.term}</b> · Session: <b className="text-emerald-900">{reportForm.session}</b>
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2 text-center">
              <div className="bg-white p-1.5 rounded border border-emerald-100 shadow-2xs">
                <span className="text-[8.5px] uppercase font-bold text-slate-400 block tracking-wider">School Days (Opened)</span>
                <span className="text-sm font-extrabold text-slate-800">{reportForm.attDays || 0}</span>
              </div>
              <div className="bg-white p-1.5 rounded border border-emerald-100 shadow-2xs">
                <span className="text-[8.5px] uppercase font-bold text-slate-400 block tracking-wider">Days Present</span>
                <span className="text-sm font-extrabold text-emerald-700">{reportForm.attPresent || 0}</span>
              </div>
              <div className="bg-white p-1.5 rounded border border-emerald-100 shadow-2xs">
                <span className="text-[8.5px] uppercase font-bold text-slate-400 block tracking-wider">Days Absent</span>
                <span className="text-sm font-extrabold text-rose-700">{reportForm.attAbsent || 0}</span>
              </div>
              <div className="bg-white p-1.5 rounded border border-emerald-100 shadow-2xs">
                <span className="text-[8.5px] uppercase font-bold text-slate-400 block tracking-wider">Attendance Rate</span>
                <span className="text-sm font-extrabold text-blue-700">{reportForm.attPercent || 0}%</span>
              </div>
              <div className="bg-white p-1.5 rounded border border-emerald-100 shadow-2xs flex flex-col justify-center">
                <span className="text-[8.5px] uppercase font-bold text-slate-400 block tracking-wider">AFL Tasks</span>
                <span className="text-[11px] font-bold text-emerald-800">{afl.length} Tasks Recorded</span>
              </div>
            </div>
          </div>

          {/* AFL Assessments Table */}
          <div className="border border-slate-300 rounded-lg overflow-hidden mb-3">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                  <th className="p-2 text-left w-[14%]">Date</th>
                  <th className="p-2 text-left w-[22%]">Subject</th>
                  <th className="p-2 text-left w-[18%]">Assessment Type</th>
                  <th className="p-2 text-center w-[14%]">Raw Score</th>
                  <th className="p-2 text-center w-[12%]">Score (10)</th>
                  <th className="p-2 text-center w-[10%]">Percentage</th>
                  <th className="p-2 text-center w-[10%]">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {afl.map((r, i) => {
                  const pct = getPct(r);
                  const score10 = getScore10(r);
                  const g = config.grades.find(z => pct >= z.min) || config.grades[config.grades.length - 1];
                  return (
                    <tr key={r.id} className={i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                      <td className="p-1.5 px-2 text-slate-600">{new Date(r.submittedAt).toLocaleDateString()}</td>
                      <td className="p-1.5 px-2 font-medium text-slate-900">{r.subject}</td>
                      <td className="p-1.5 px-2 text-slate-700">{r.type}</td>
                      <td className="p-1.5 text-center text-slate-700">{r.raw} / {r.rawMax}</td>
                      <td className="p-1.5 text-center font-bold text-emerald-700">{score10.toFixed(1)}</td>
                      <td className="p-1.5 text-center font-bold text-slate-900">{pct}%</td>
                      <td className="p-1.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${getGradeBadge(g?.grade)}`}>
                          {g?.grade}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {afl.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-3 text-center text-slate-500">No AFL assessments recorded for this student.</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900 border-t border-slate-300 text-[11px]">
                  <td className="p-2" colSpan={4}>
                    <span className="uppercase tracking-wider text-[10px] text-slate-500 mr-2">Formative Summary:</span>
                    {afl.length} Tasks Recorded
                  </td>
                  <td className="p-2 text-center text-emerald-700 font-extrabold">{avg10.toFixed(1)} / 10</td>
                  <td className="p-2 text-center text-slate-900 font-bold">{avg.toFixed(1)}%</td>
                  <td className="p-2 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${getGradeBadge(config.grades.find(z => avg >= z.min)?.grade || '')}`}>
                      {config.grades.find(z => avg >= z.min)?.grade || '-'}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Performance Chart - Measured by 10 for AFL */}
          <div className="border border-emerald-200 rounded-lg p-2.5 bg-white mb-3 shadow-2xs">
            <div className="flex items-center justify-between mb-1">
              <h4 className="m-0 text-[10.5px] font-bold uppercase tracking-wider text-emerald-900">AFL Subject Performance Analysis</h4>
              <span className="text-[9.5px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Measured by 10 (Scale: 0 – 10)
              </span>
            </div>
            <div className="h-[135px]">
              <Bar 
                data={chartData} 
                options={{ 
                  responsive: true, 
                  maintainAspectRatio: false, 
                  animation: false,
                  plugins: { 
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (ctx) => `Score: ${ctx.raw} / 10`
                      }
                    }
                  }, 
                  scales: { 
                    y: { 
                      max: 10, 
                      min: 0, 
                      ticks: { 
                        stepSize: 2, 
                        font: { size: 9 },
                        callback: (val: any) => `${val}/10`
                      },
                      title: {
                        display: true,
                        text: 'Score (out of 10)',
                        font: { size: 9, weight: 'bold' }
                      }
                    }, 
                    x: { ticks: { font: { size: 9.5 } } } 
                  } 
                }} 
              />
            </div>
          </div>

          {/* Teacher & Principal Remarks */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="border border-slate-200 rounded-lg p-2.5 bg-white">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-1">Teacher's Observations</span>
              <p className="text-[10.5px] text-slate-700 italic m-0 min-h-[30px]">
                "{reportForm.teacherComment || 'Consistent class participation and steady progress observed during class tasks.'}"
              </p>
            </div>
            <div className="border border-slate-200 rounded-lg p-2.5 bg-white">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-1">Principal's Review</span>
              <p className="text-[10.5px] text-slate-700 italic m-0 min-h-[30px]">
                "{reportForm.principalComment || 'Good formative assessment results. Continuous improvement encouraged.'}"
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Section: Signatures & Stamp */}
        <div>
          {/* Official Signatures and Seal */}
          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-300 text-center items-end">
            <div className="flex flex-col items-center">
              {reportForm.teacherSignature ? (
                <img src={reportForm.teacherSignature} alt="Teacher Signature" className="h-10 object-contain mb-1" crossOrigin="anonymous" />
              ) : (
                <div className="h-10 border-b border-dashed border-slate-300 w-36 mb-1" />
              )}
              <div className="text-[10px] text-slate-800 font-bold">{reportForm.teacherName || 'Class Teacher'}</div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">Class Teacher</div>
            </div>

            <div className="flex flex-col items-center justify-center">
              <div className="w-13 h-13 rounded-full border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 mb-1">
                <span className="text-[7px] uppercase font-black tracking-widest text-center leading-tight">OFFICIAL<br/>SEAL</span>
              </div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">EduCore Verified</div>
            </div>

            <div className="flex flex-col items-center">
              {reportForm.principalSignature ? (
                <img src={reportForm.principalSignature} alt="Principal Signature" className="h-10 object-contain mb-1" crossOrigin="anonymous" />
              ) : (
                <div className="h-10 border-b border-dashed border-slate-300 w-36 mb-1" />
              )}
              <div className="text-[10px] text-slate-800 font-bold">{branding.principal || 'Principal'}</div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">Principal / Head of School</div>
            </div>
          </div>

          <div className="mt-2 pt-1 border-t border-slate-100 text-[8.5px] text-slate-400 flex justify-between items-center">
            <span>Official Computer-Generated Formative Assessment Transcript · EduCore Portal</span>
            <span>Date Issued: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
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
          {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.class})</option>)}
        </Select>
        {students.length === 0 && (
          <p className="text-sm text-amber-600 mt-2">
            No students found registered for your assigned class ({teacherClasses.join(', ') || 'No classes assigned'}).
          </p>
        )}
        
        <div className="flex gap-2 mt-4">
          <Button onClick={() => generateReport('academic')}>Academic Report</Button>
          <Button variant="secondary" onClick={() => generateReport('afl')}>AFL Report Card</Button>
        </div>
      </Card>
      
      <Modal 
        isOpen={isReportOpen} 
        onClose={() => setIsReportOpen(false)}
        className="max-w-[1180px] w-[96vw] max-h-[95vh] flex flex-col p-4 md:p-5 overflow-hidden"
      >
        <div className="w-full flex flex-col min-h-0 flex-1 overflow-hidden">
          {/* Top Modal Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 shrink-0">
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-900 m-0">
                {reportKind === 'academic' ? 'Academic Report Preview & Details' : 'AFL Formative Report Preview & Details'}
              </h2>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Student: <span className="font-semibold text-slate-800">{s?.name}</span> ({s?.class}) · ID: {s?.id}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                Real-time Preview Sync
              </span>
              <button 
                onClick={() => setIsReportOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 text-base font-bold transition"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Main Body - Scrollable content containing both the editable section & preview */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 min-h-0">
            {/* Scrollable Editable Information Panel */}
            <Card className="border border-slate-200 shadow-2xs p-0 overflow-hidden bg-white">
              <div className="p-3 px-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                  <h3 className="text-xs md:text-sm font-bold text-slate-800 m-0">Student Report Details & Remarks</h3>
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Live Preview Synchronization
                </div>
              </div>

              {/* Scrollable inputs container */}
              <div className="max-h-[250px] md:max-h-[290px] overflow-y-auto p-4 space-y-4">
                {/* 1. Academic & Session Details */}
                <div>
                  <h4 className="text-[11px] uppercase tracking-wider font-bold text-slate-500 m-0 mb-2">Session & Class Standing</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div>
                      <Label className="mt-0">Term</Label>
                      <Input value={reportForm.term || ''} onChange={e => setReportForm((p: any) => ({ ...p, term: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="mt-0">Session</Label>
                      <Input value={reportForm.session || ''} onChange={e => setReportForm((p: any) => ({ ...p, session: e.target.value }))} />
                    </div>
                    {reportKind === 'academic' && (
                      <>
                        <div>
                          <Label className="mt-0">Class Position</Label>
                          <Input placeholder="e.g. 1st / 32" value={reportForm.position || ''} onChange={e => setReportForm((p: any) => ({ ...p, position: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="mt-0">Next Term Resumes</Label>
                          <Input placeholder="e.g. Sept 14, 2026" value={reportForm.nextTerm || ''} onChange={e => setReportForm((p: any) => ({ ...p, nextTerm: e.target.value }))} />
                        </div>
                      </>
                    )}
                    <div>
                      <Label className="mt-0">Class Teacher Name</Label>
                      <Input value={reportForm.teacherName || ''} onChange={e => setReportForm((p: any) => ({ ...p, teacherName: e.target.value }))} />
                    </div>
                  </div>
                </div>

                {/* 2. Attendance with Automatic Calculations */}
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[11px] uppercase tracking-wider font-bold text-slate-500 m-0">Attendance Record</h4>
                    <span className="text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      Absence and Attendance % auto-calculate automatically
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label className="mt-0 flex items-center justify-between">
                        <span>School Days (Opened)</span>
                        <span className="text-[10px] text-blue-600 font-medium">Input</span>
                      </Label>
                      <Input 
                        type="number" 
                        min="0"
                        placeholder="e.g. 100" 
                        value={reportForm.attDays ?? ''} 
                        onChange={e => handleAttendanceChange('attDays', e.target.value)} 
                      />
                    </div>
                    <div>
                      <Label className="mt-0 flex items-center justify-between">
                        <span>Days Present</span>
                        <span className="text-[10px] text-blue-600 font-medium">Input</span>
                      </Label>
                      <Input 
                        type="number" 
                        min="0"
                        placeholder="e.g. 96" 
                        value={reportForm.attPresent ?? ''} 
                        onChange={e => handleAttendanceChange('attPresent', e.target.value)} 
                      />
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
                        value={reportForm.attAbsent ?? 0} 
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
                        value={reportForm.attPercent ?? 0} 
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Remarks & Signatures */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <h4 className="text-[11px] uppercase tracking-wider font-bold text-slate-500 m-0">Remarks & Signatures</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="mt-0">Class Teacher's Appraisal Remark</Label>
                      <Textarea 
                        rows={2} 
                        value={reportForm.teacherComment || ''} 
                        onChange={e => setReportForm((p: any) => ({ ...p, teacherComment: e.target.value }))} 
                      />
                    </div>
                    <div>
                      <Label className="mt-0">Principal's Recommendation / Remark</Label>
                      <Textarea 
                        rows={2} 
                        value={reportForm.principalComment || ''} 
                        onChange={e => setReportForm((p: any) => ({ ...p, principalComment: e.target.value }))} 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <Label className="mt-0">Class Teacher Signature (Image)</Label>
                      <Input 
                        type="file" 
                        accept="image/*" 
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const r = new FileReader();
                            r.onload = () => setReportForm((p: any) => ({ ...p, teacherSignature: r.result }));
                            r.readAsDataURL(file);
                          }
                        }} 
                      />
                      {reportForm.teacherSignature && (
                        <div className="mt-2 flex items-center justify-between bg-white p-1.5 px-2 rounded border border-slate-200">
                          <div className="flex items-center gap-2">
                            <img src={reportForm.teacherSignature} alt="Teacher Signature" className="h-6 max-w-[80px] object-contain" />
                            <span className="text-[11px] text-emerald-600 font-medium">Signature uploaded</span>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => setReportForm((p: any) => ({ ...p, teacherSignature: '' }))} 
                            className="text-[11px] text-rose-500 hover:text-rose-700 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <Label className="mt-0">Principal Signature (Image)</Label>
                      <Input 
                        type="file" 
                        accept="image/*" 
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const r = new FileReader();
                            r.onload = () => setReportForm((p: any) => ({ ...p, principalSignature: r.result }));
                            r.readAsDataURL(file);
                          }
                        }} 
                      />
                      {reportForm.principalSignature && (
                        <div className="mt-2 flex items-center justify-between bg-white p-1.5 px-2 rounded border border-slate-200">
                          <div className="flex items-center gap-2">
                            <img src={reportForm.principalSignature} alt="Principal Signature" className="h-6 max-w-[80px] object-contain" />
                            <span className="text-[11px] text-emerald-600 font-medium">Signature uploaded</span>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => setReportForm((p: any) => ({ ...p, principalSignature: '' }))} 
                            className="text-[11px] text-rose-500 hover:text-rose-700 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Section 2: Live High-Resolution Report Preview */}
            <div className="overflow-auto bg-slate-200/90 p-3 md:p-5 rounded-[14px] flex justify-center border border-slate-300 shadow-inner">
              {reportKind === 'academic' ? renderAcademicReport() : renderAflReport()}
            </div>
          </div>

          {/* Sticky Modal Footer Controls */}
          <div className="flex flex-wrap justify-center sm:justify-end items-center gap-2 pt-3 mt-2 border-t border-slate-200 shrink-0 bg-white">
            <Button variant="success" onClick={saveReportDetails}>Save Report Details</Button>
            <Button disabled={isGeneratingPdf} onClick={() => { saveReportDetails(); downloadPDF(); }}>
              {isGeneratingPdf ? 'Generating High-Res PDF...' : 'Download High-Res PDF'}
            </Button>
            <Button variant="secondary" onClick={() => setIsReportOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
