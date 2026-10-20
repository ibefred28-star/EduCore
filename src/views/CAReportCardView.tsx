import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Card, Button, Select, Label, Input, Textarea, Modal } from '../components/ui';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { CLASS_OPTIONS } from '../constants';
import { isStudentInTeacherClasses } from '../lib/classUtils';
import { computeStudentCASummary, StudentCASummary } from '../lib/caUtils';
import { AssessmentType } from '../types';
import {
  useSchoolResultsSubscription,
  useStudentsSubscription
} from '../hooks/useDomainSubscriptions';

interface CAReportCardViewProps {
  initialType?: 'CA1' | 'CA2' | 'Combined';
}

export default function CAReportCardView({ initialType = 'CA1' }: CAReportCardViewProps) {
  const { data, config, branding, currentUser, currentRole, updateData, schoolId } = useStore();
  const showToast = useToastStore(s => s.showToast);

  // Live students and results subscriptions
  const { students: liveStudents } = useStudentsSubscription(schoolId);
  const { results: liveSchoolResults } = useSchoolResultsSubscription(schoolId);

  const allStudents = useMemo(() => {
    return (liveStudents && liveStudents.length > 0) ? liveStudents : (data.students || []);
  }, [liveStudents, data.students]);

  // Merge results and normalize AFL to CA 1 and CA 2 cleanly
  const allResults = useMemo(() => {
    const map = new Map<string, any>();
    (data.results || []).forEach(r => map.set(String(r.id), r));
    (liveSchoolResults || []).forEach(r => map.set(String(r.id), r));
    return Array.from(map.values()).map(r => {
      const typeStr = String(r.type || '').trim().toUpperCase();
      const titleStr = String((r as any).examTitle || (r as any).title || '').trim().toUpperCase();
      if (typeStr === 'AFL' || typeStr === 'CA 1' || typeStr === 'CA1') {
        return { ...r, type: 'CA 1' };
      }
      if (typeStr === 'CA 2' || typeStr === 'CA2' || titleStr.includes('CA 2') || titleStr.includes('CA2')) {
        return { ...r, type: 'CA 2' };
      }
      return r;
    });
  }, [data.results, liveSchoolResults]);

  const teacher = currentRole === 'teacher'
    ? data.teachers.find(t => (t.id || '').trim().toLowerCase() === (currentUser?.id || '').trim().toLowerCase()) || (currentUser as any)
    : null;
  const teacherClasses = teacher?.classes || [];
  const teacherPupils = teacher?.pupils || [];

  // Allowed students
  const filteredStudents = useMemo(() => {
    if (currentRole === 'student') {
      return allStudents.filter(s => (s.id || '').trim().toLowerCase() === (currentUser?.id || '').trim().toLowerCase());
    }
    if (currentRole === 'teacher') {
      if (teacherClasses.length > 0 || (teacherPupils && teacherPupils.length > 0)) {
        return allStudents.filter(s => isStudentInTeacherClasses(s.class, teacherClasses, teacherPupils, s.id));
      }
    }
    return allStudents;
  }, [allStudents, currentRole, currentUser, teacherClasses, teacherPupils]);

  // Selections
  const [activeType, setActiveType] = useState<'CA1' | 'CA2' | 'Combined'>(initialType);
  const [session, setSession] = useState('2026/2027');
  const [term, setTerm] = useState('First Term');
  const [selectedClass, setSelectedClass] = useState<string>(
    filteredStudents[0]?.class || 'Primary 5'
  );

  const studentsInClass = useMemo(() => {
    if (currentRole === 'student') return filteredStudents;
    return filteredStudents.filter(s => isStudentInTeacherClasses(s.class, [selectedClass]));
  }, [filteredStudents, selectedClass, currentRole]);

  const [studentId, setStudentId] = useState<string>(
    studentsInClass[0]?.id || filteredStudents[0]?.id || ''
  );

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [remarksForm, setRemarksForm] = useState<any>({});
  const reportCardRef = useRef<HTMLDivElement>(null);

  // Sync student selection when class or list changes
  useEffect(() => {
    if (studentsInClass.length > 0 && !studentsInClass.find(s => s.id === studentId)) {
      setStudentId(studentsInClass[0].id);
    }
  }, [studentsInClass, studentId]);

  const currentStudent = allStudents.find(
    s => (s.id || '').trim().toLowerCase() === (studentId || '').trim().toLowerCase()
  );

  // Load remarks for current student & assessment type
  useEffect(() => {
    if (!currentStudent) return;
    if (activeType === 'CA1') {
      setRemarksForm({
        position: currentStudent.ca1Position || currentStudent.position || '',
        teacherComment: currentStudent.ca1TeacherComment || 'Good progress demonstrated in continuous assessment.',
        principalComment: currentStudent.ca1PrincipalComment || 'Commendable effort. Maintain consistency.',
        teacherSignature: currentStudent.teacherSignature || '',
        principalSignature: currentStudent.principalSignature || '',
        teacherName: currentStudent.teacherName || currentUser?.name || 'Class Teacher'
      });
    } else if (activeType === 'CA2') {
      setRemarksForm({
        position: currentStudent.ca2Position || currentStudent.position || '',
        teacherComment: currentStudent.ca2TeacherComment || 'Active participation and steady improvement shown.',
        principalComment: currentStudent.ca2PrincipalComment || 'Keep up the diligence towards terminal examinations.',
        teacherSignature: currentStudent.teacherSignature || '',
        principalSignature: currentStudent.principalSignature || '',
        teacherName: currentStudent.teacherName || currentUser?.name || 'Class Teacher'
      });
    } else {
      setRemarksForm({
        position: currentStudent.position || '',
        teacherComment: currentStudent.teacherComment || 'Strong combined continuous assessment performance.',
        principalComment: currentStudent.principalComment || 'Well prepared for academic advancement.',
        teacherSignature: currentStudent.teacherSignature || '',
        principalSignature: currentStudent.principalSignature || '',
        teacherName: currentStudent.teacherName || currentUser?.name || 'Class Teacher'
      });
    }
  }, [currentStudent, activeType, currentUser]);

  // Compute student CA summary with strict normalization & incomplete tracking
  const caSummary: StudentCASummary = useMemo(() => {
    if (!currentStudent) {
      return computeStudentCASummary('', data.subjects, [], [], config, session, term);
    }
    return computeStudentCASummary(
      currentStudent.id,
      data.subjects,
      data.assessments || [],
      allResults,
      config,
      session,
      term
    );
  }, [currentStudent, data.subjects, data.assessments, allResults, config, session, term]);

  // Auto-save remarks
  const saveRemarks = () => {
    if (!currentStudent) return;
    updateData(draft => {
      const s = draft.students.find(x => x.id === currentStudent.id);
      if (s) {
        if (activeType === 'CA1') {
          s.ca1Position = remarksForm.position;
          s.ca1TeacherComment = remarksForm.teacherComment;
          s.ca1PrincipalComment = remarksForm.principalComment;
        } else if (activeType === 'CA2') {
          s.ca2Position = remarksForm.position;
          s.ca2TeacherComment = remarksForm.teacherComment;
          s.ca2PrincipalComment = remarksForm.principalComment;
        } else {
          s.position = remarksForm.position;
          s.teacherComment = remarksForm.teacherComment;
          s.principalComment = remarksForm.principalComment;
        }
        s.teacherName = remarksForm.teacherName;
        s.teacherSignature = remarksForm.teacherSignature;
        s.principalSignature = remarksForm.principalSignature;
      }
    });
    showToast('Report card remarks saved');
  };

  // PDF generation
  const downloadPDF = async () => {
    if (!reportCardRef.current || !currentStudent) return;
    setIsDownloadingPdf(true);
    try {
      // Wait for images
      const images = Array.from(reportCardRef.current.querySelectorAll('img')) as HTMLImageElement[];
      await Promise.all(
        images.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(res => {
            img.onload = res;
            img.onerror = res;
          });
        })
      );

      const canvas = await html2canvas(reportCardRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      const safeName = (currentStudent.name || 'Student').replace(/[^a-zA-Z0-9_-]/g, '_');
      pdf.save(`${activeType}_Report_Card_${safeName}.pdf`);
      showToast('Official Continuous Assessment Report Card downloaded!');
    } catch (err) {
      console.error('Error generating CA report card PDF:', err);
      showToast('Could not generate PDF. Please try again or use Print.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Switch student helper
  const currentIndex = studentsInClass.findIndex(s => s.id === studentId);
  const handlePrevStudent = () => {
    if (currentIndex > 0) {
      setStudentId(studentsInClass[currentIndex - 1].id);
    }
  };
  const handleNextStudent = () => {
    if (currentIndex >= 0 && currentIndex < studentsInClass.length - 1) {
      setStudentId(studentsInClass[currentIndex + 1].id);
    }
  };

  const getBadgeClass = (grade?: string) => {
    const g = (grade || '').toUpperCase();
    if (g === 'A') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (g === 'B') return 'bg-blue-100 text-blue-800 border-blue-300';
    if (g === 'C') return 'bg-amber-100 text-amber-800 border-amber-300';
    if (g === 'D') return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-rose-100 text-rose-800 border-rose-300';
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Navigation Bar (Hidden during print) */}
      <Card className="border border-slate-200 shadow-xs print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${activeType === 'CA1' ? 'bg-blue-600' : activeType === 'CA2' ? 'bg-indigo-600' : 'bg-emerald-600'}`}></span>
              <h2 className="text-xl font-bold text-slate-900 m-0">
                {activeType === 'CA1' ? 'Continuous Assessment 1 (CA1) Report Card' : activeType === 'CA2' ? 'Continuous Assessment 2 (CA2) Report Card' : 'Combined Continuous Assessment (CA1 + CA2) Report Card'}
              </h2>
            </div>
            <p className="text-xs text-slate-500 m-0 mt-1">
              Independent report card for {activeType}. Distinguishes unrecorded subjects from zero scores and normalizes totals to 100%.
            </p>
          </div>

          {/* Report Category Switcher */}
          <div className="flex rounded-md overflow-hidden border border-slate-300 bg-slate-100 p-0.5">
            <button
              onClick={() => setActiveType('CA1')}
              className={`px-3 py-1.5 text-xs font-bold rounded transition ${activeType === 'CA1' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'}`}
            >
              CA 1 Report (20)
            </button>
            <button
              onClick={() => setActiveType('CA2')}
              className={`px-3 py-1.5 text-xs font-bold rounded transition ${activeType === 'CA2' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'}`}
            >
              CA 2 Report (20)
            </button>
            <button
              onClick={() => setActiveType('Combined')}
              className={`px-3 py-1.5 text-xs font-bold rounded transition ${activeType === 'Combined' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'}`}
            >
              Combined CA (40)
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4">
          <div>
            <Label className="mt-0 font-semibold text-xs text-slate-700">Academic Session</Label>
            <Select value={session} onChange={e => setSession(e.target.value)}>
              <option value="2026/2027">2026/2027</option>
              <option value="2025/2026">2025/2026</option>
              <option value="2024/2025">2024/2025</option>
            </Select>
          </div>

          <div>
            <Label className="mt-0 font-semibold text-xs text-slate-700">Term</Label>
            <Select value={term} onChange={e => setTerm(e.target.value)}>
              <option value="First Term">First Term</option>
              <option value="Second Term">Second Term</option>
              <option value="Third Term">Third Term</option>
            </Select>
          </div>

          {currentRole !== 'student' && (
            <div>
              <Label className="mt-0 font-semibold text-xs text-slate-700">Class</Label>
              <Select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                {CLASS_OPTIONS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <Label className="mt-0 font-semibold text-xs text-slate-700">Pupil</Label>
            <Select value={studentId} onChange={e => setStudentId(e.target.value)}>
              {studentsInClass.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
              ))}
            </Select>
          </div>
        </div>

        {/* Action Buttons & Pupil Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-4 border-t border-slate-100">
          <div className="flex items-center gap-2">
            {currentRole !== 'student' && (
              <>
                <Button 
                  variant="secondary" 
                  disabled={currentIndex <= 0} 
                  onClick={handlePrevStudent} 
                  className="text-xs py-1.5 px-3"
                >
                  ← Previous Pupil
                </Button>
                <span className="text-xs text-slate-500 font-medium">
                  {currentIndex + 1} of {studentsInClass.length}
                </span>
                <Button 
                  variant="secondary" 
                  disabled={currentIndex < 0 || currentIndex >= studentsInClass.length - 1} 
                  onClick={handleNextStudent} 
                  className="text-xs py-1.5 px-3"
                >
                  Next Pupil →
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handlePrint} className="text-xs py-1.5 px-4 font-bold flex items-center gap-1.5">
              <span>🖨️</span> Print Report Card
            </Button>
            <Button 
              onClick={downloadPDF} 
              disabled={isDownloadingPdf || !currentStudent} 
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-1.5 px-4 flex items-center gap-1.5 shadow-xs"
            >
              <span>📄</span> {isDownloadingPdf ? 'Generating PDF...' : 'Download Official PDF'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Editable Remarks Accordion / Panel (Staff access only, hidden in print) */}
      {currentRole !== 'student' && currentStudent && (
        <Card className="border border-slate-200 shadow-xs print:hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900 m-0">
                Staff Remarks & Assessment Standing ({activeType})
              </h3>
              <p className="text-[11px] text-slate-500 m-0">
                Edit teacher comment, head of school endorsement, and class position for {currentStudent.name}.
              </p>
            </div>
            <Button variant="secondary" onClick={saveRemarks} className="text-xs py-1 px-3">
              Save Remarks
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3">
            <div>
              <Label className="mt-0 text-xs">Class Position</Label>
              <Input 
                placeholder="e.g. 1st / 32" 
                value={remarksForm.position || ''} 
                onChange={e => setRemarksForm((p: any) => ({ ...p, position: e.target.value }))} 
              />
            </div>

            <div>
              <Label className="mt-0 text-xs">Class Teacher Comment</Label>
              <Input 
                value={remarksForm.teacherComment || ''} 
                onChange={e => setRemarksForm((p: any) => ({ ...p, teacherComment: e.target.value }))} 
              />
            </div>

            <div>
              <Label className="mt-0 text-xs">Principal / Head of School Comment</Label>
              <Input 
                value={remarksForm.principalComment || ''} 
                onChange={e => setRemarksForm((p: any) => ({ ...p, principalComment: e.target.value }))} 
              />
            </div>
          </div>
        </Card>
      )}

      {/* Provisional / Incomplete Notice if some scores unrecorded */}
      {caSummary.isProvisional && (
        <div className="p-3.5 px-4 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2.5 shadow-2xs print:hidden">
          <span className="text-base leading-none">⚠️</span>
          <div>
            <strong className="font-bold">Provisional Continuous Assessment Report:</strong>
            <p className="m-0 mt-0.5">
              {caSummary.unrecordedSubjectsCount > 0 
                ? `${caSummary.unrecordedSubjectsCount} subject(s) currently have unrecorded continuous assessments. `
                : ''}
              {caSummary.partialSubjectsCount > 0
                ? `${caSummary.partialSubjectsCount} subject(s) have incomplete components. `
                : ''}
              Unrecorded assessments are clearly tagged and <strong>never treated as zero</strong>. The calculated percentage reflects only recorded data.
            </p>
          </div>
        </div>
      )}

      {/* =========================================================================
          OFFICIAL REPORT CARD PREVIEW / PRINTABLE CONTAINER (A4 standard: 794px)
          ========================================================================= */}
      <div className="flex justify-center overflow-x-auto pb-8">
        <div
          ref={reportCardRef}
          style={{ width: '794px', minHeight: '1123px', boxSizing: 'border-box' }}
          className="w-[794px] min-h-[1123px] bg-white p-7 text-slate-800 text-[11.5px] leading-snug flex flex-col justify-between font-sans box-border shadow-md border border-slate-200 rounded-sm print:border-0 print:shadow-none print:m-0 print:p-6"
        >
          <div>
            {/* 1. Official School Letterhead */}
            <div 
              className="flex items-center justify-between pb-3 border-b-2" 
              style={{ borderColor: branding.primary || '#1e3a8a' }}
            >
              <div className="w-[72px] h-[72px] flex items-center justify-center shrink-0">
                {branding.logo ? (
                  <img
                    className="max-w-[72px] max-h-[72px] object-contain rounded-full border border-slate-200 shadow-2xs"
                    src={branding.logo}
                    alt="School Logo"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div
                    className="w-[64px] h-[64px] rounded-full flex items-center justify-center text-white font-black text-2xl shadow-2xs"
                    style={{ backgroundColor: branding.primary || '#1e3a8a' }}
                  >
                    {branding.schoolName?.charAt(0) || 'E'}
                  </div>
                )}
              </div>

              <div className="text-center flex-1 px-3">
                <h1 className="text-xl font-black uppercase tracking-tight text-slate-900 m-0">
                  {branding.schoolName}
                </h1>
                <p className="text-xs italic font-medium text-slate-600 mt-0.5 mb-1">
                  {branding.motto || 'Knowledge, Discipline & Excellence'}
                </p>
                <p className="text-[10px] text-slate-500 m-0">
                  {branding.address} {branding.phone ? `· Tel: ${branding.phone}` : ''}
                </p>
              </div>

              <div className="w-[88px] flex flex-col items-center justify-center text-right shrink-0">
                <span className="text-[8.5px] uppercase tracking-wider font-bold text-slate-400">Continuous</span>
                <span className="text-[10.5px] font-black uppercase text-blue-900">
                  {activeType === 'CA1' ? 'CA1 REPORT' : activeType === 'CA2' ? 'CA2 REPORT' : 'COMBINED CA'}
                </span>
                <div 
                  className="w-10 h-1 rounded-full mt-1" 
                  style={{ backgroundColor: activeType === 'CA1' ? '#2563eb' : activeType === 'CA2' ? '#4f46e5' : '#10b981' }} 
                />
              </div>
            </div>

            {/* 2. Document Title Banner */}
            <div className="text-center my-2.5 py-1.5 px-3 rounded-md bg-slate-100 flex items-center justify-between border border-slate-200">
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                {activeType === 'CA1' 
                  ? 'Continuous Assessment 1 (CA1) Terminal Report Card'
                  : activeType === 'CA2'
                  ? 'Continuous Assessment 2 (CA2) Terminal Report Card'
                  : 'Combined Continuous Assessment (CA1 & CA2) Report Card'}
              </span>
              <span className="text-[11px] font-semibold text-slate-600">
                {term} · {session} Session
              </span>
            </div>

            {/* 3. Student Profile Information Card */}
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/70 mb-3 text-[11px]">
              <div className="flex items-center gap-4">
                {currentStudent?.photo ? (
                  <img
                    src={currentStudent.photo}
                    alt="Student"
                    className="w-16 h-16 rounded-md object-cover border border-slate-300 shadow-2xs"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-md bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-base border border-slate-300">
                    {currentStudent?.name?.charAt(0) || 'S'}
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1.5 flex-1">
                  <div>
                    <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Pupil Full Name</span>
                    <strong className="text-slate-900 text-xs">{currentStudent?.name || 'N/A'}</strong>
                  </div>

                  <div>
                    <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Admission / ID</span>
                    <strong className="text-slate-900 font-mono text-xs">{currentStudent?.id || 'N/A'}</strong>
                  </div>

                  <div>
                    <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Class / Grade</span>
                    <strong className="text-slate-900 text-xs">{currentStudent?.class || selectedClass}</strong>
                  </div>

                  <div>
                    <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Class Standing</span>
                    <strong className="text-indigo-800 font-bold text-xs">
                      {remarksForm.position || 'Evaluated'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Academic Period</span>
                    <span className="text-slate-700">{term} ({session})</span>
                  </div>

                  <div>
                    <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Component Type</span>
                    <span className="text-slate-700 font-bold">
                      {activeType === 'CA1' ? 'Continuous Assessment 1' : activeType === 'CA2' ? 'Continuous Assessment 2' : 'Combined CA (CA1 + CA2)'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Max Mark Per Subject</span>
                    <span className="text-slate-700 font-bold">
                      {activeType === 'Combined' ? '40 Marks' : '20 Marks'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Report Status</span>
                    <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${caSummary.isOverallComplete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {caSummary.isOverallComplete ? 'Official Complete' : 'Provisional / Partial'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Subject-by-Subject Assessment Performance Table */}
            <div className="border border-slate-300 rounded-lg overflow-hidden mb-3">
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <th className="p-2 text-left">Subject</th>

                    {/* Dynamic Columns based on activeType */}
                    {activeType === 'CA1' && (
                      <>
                        <th className="p-2 text-center w-[18%] font-black text-blue-900">CA 1 Score (/20)</th>
                        <th className="p-2 text-center w-[14%]">Percentage</th>
                        <th className="p-2 text-center w-[12%]">Grade</th>
                        <th className="p-2 text-left w-[22%]">Assessment Status</th>
                      </>
                    )}

                    {activeType === 'CA2' && (
                      <>
                        <th className="p-2 text-center w-[18%] font-black text-indigo-900">CA 2 Score (/20)</th>
                        <th className="p-2 text-center w-[14%]">Percentage</th>
                        <th className="p-2 text-center w-[12%]">Grade</th>
                        <th className="p-2 text-left w-[22%]">Assessment Status</th>
                      </>
                    )}

                    {activeType === 'Combined' && (
                      <>
                        <th className="p-2 text-center w-[12%]">CA 1 (/20)</th>
                        <th className="p-2 text-center w-[12%]">CA 2 (/20)</th>
                        <th className="p-2 text-center w-[16%] font-black text-emerald-900">Combined (/40)</th>
                        <th className="p-2 text-center w-[12%]">Norm %</th>
                        <th className="p-2 text-center w-[10%]">Grade</th>
                        <th className="p-2 text-left w-[18%]">Remark</th>
                      </>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {caSummary.subjects.map((sub, i) => {
                    const isEven = i % 2 === 1;

                    if (activeType === 'CA1') {
                      const isUnrecorded = sub.ca1Score === null;
                      return (
                        <tr key={sub.subject} className={isEven ? 'bg-slate-50/50' : 'bg-white'}>
                          <td className="p-1.5 px-2 font-semibold text-slate-900">{sub.subject}</td>
                          <td className="p-1.5 text-center font-bold text-blue-900 text-xs">
                            {isUnrecorded ? (
                              <span className="text-amber-600 font-semibold italic text-[10.5px]">Unrecorded</span>
                            ) : (
                              `${sub.ca1Score} / 20`
                            )}
                          </td>
                          <td className="p-1.5 text-center text-slate-700 font-medium">
                            {isUnrecorded ? '-' : `${sub.ca1Percentage}%`}
                          </td>
                          <td className="p-1.5 text-center">
                            {isUnrecorded ? (
                              <span className="text-slate-400">-</span>
                            ) : (
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getBadgeClass(sub.ca1Grade)}`}>
                                {sub.ca1Grade}
                              </span>
                            )}
                          </td>
                          <td className="p-1.5 px-2 text-[10.5px]">
                            {isUnrecorded ? (
                              <span className="text-amber-700 font-medium">Pending Submission</span>
                            ) : sub.ca1Score! >= 15 ? (
                              <span className="text-emerald-700 font-medium">Mastery Demonstrated</span>
                            ) : sub.ca1Score! >= 10 ? (
                              <span className="text-blue-700 font-medium">Satisfactory</span>
                            ) : (
                              <span className="text-rose-700 font-medium">Requires Remediation</span>
                            )}
                          </td>
                        </tr>
                      );
                    }

                    if (activeType === 'CA2') {
                      const isUnrecorded = sub.ca2Score === null;
                      return (
                        <tr key={sub.subject} className={isEven ? 'bg-slate-50/50' : 'bg-white'}>
                          <td className="p-1.5 px-2 font-semibold text-slate-900">{sub.subject}</td>
                          <td className="p-1.5 text-center font-bold text-indigo-900 text-xs">
                            {isUnrecorded ? (
                              <span className="text-amber-600 font-semibold italic text-[10.5px]">Unrecorded</span>
                            ) : (
                              `${sub.ca2Score} / 20`
                            )}
                          </td>
                          <td className="p-1.5 text-center text-slate-700 font-medium">
                            {isUnrecorded ? '-' : `${sub.ca2Percentage}%`}
                          </td>
                          <td className="p-1.5 text-center">
                            {isUnrecorded ? (
                              <span className="text-slate-400">-</span>
                            ) : (
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getBadgeClass(sub.ca2Grade)}`}>
                                {sub.ca2Grade}
                              </span>
                            )}
                          </td>
                          <td className="p-1.5 px-2 text-[10.5px]">
                            {isUnrecorded ? (
                              <span className="text-amber-700 font-medium">Pending Submission</span>
                            ) : sub.ca2Score! >= 15 ? (
                              <span className="text-emerald-700 font-medium">Mastery Demonstrated</span>
                            ) : sub.ca2Score! >= 10 ? (
                              <span className="text-blue-700 font-medium">Satisfactory</span>
                            ) : (
                              <span className="text-rose-700 font-medium">Requires Remediation</span>
                            )}
                          </td>
                        </tr>
                      );
                    }

                    // Combined CA
                    const hasCA1 = sub.ca1Score !== null;
                    const hasCA2 = sub.ca2Score !== null;
                    const isComplete = sub.isComplete;

                    return (
                      <tr key={sub.subject} className={isEven ? 'bg-slate-50/50' : 'bg-white'}>
                        <td className="p-1.5 px-2 font-semibold text-slate-900">{sub.subject}</td>
                        <td className="p-1.5 text-center text-slate-700">
                          {hasCA1 ? `${sub.ca1Score}` : <span className="text-amber-600 italic">Unrecorded</span>}
                        </td>
                        <td className="p-1.5 text-center text-slate-700">
                          {hasCA2 ? `${sub.ca2Score}` : <span className="text-amber-600 italic">Unrecorded</span>}
                        </td>
                        <td className="p-1.5 text-center font-bold text-slate-900">
                          {isComplete ? (
                            <span className="text-emerald-800">{sub.combinedScore} / 40</span>
                          ) : (
                            <span className="text-amber-700 font-medium text-[10px]">
                              {hasCA1 ? `${sub.ca1Score} / 20 (Part)` : (hasCA2 ? `${sub.ca2Score} / 20 (Part)` : 'Unrecorded')}
                            </span>
                          )}
                        </td>
                        <td className="p-1.5 text-center text-slate-700 font-medium">
                          {isComplete ? `${sub.combinedPercentage}%` : '-'}
                        </td>
                        <td className="p-1.5 text-center">
                          {isComplete ? (
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getBadgeClass(sub.combinedGrade)}`}>
                              {sub.combinedGrade}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">Inc</span>
                          )}
                        </td>
                        <td className="p-1.5 px-2 text-[10px] text-slate-600">
                          {isComplete ? sub.combinedRemark : 'Provisional: Awaiting complete CA'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Table Footer: Normalized Summary */}
                <tfoot>
                  <tr className="bg-slate-100 font-bold text-slate-900 border-t border-slate-300 text-[11px]">
                    <td className="p-2" colSpan={activeType === 'Combined' ? 3 : 1}>
                      <span className="uppercase tracking-wider text-[9.5px] text-slate-500 mr-2">Collation:</span>
                      {activeType === 'CA1' && `${caSummary.recordedCA1Count} of ${caSummary.totalSubjectsCount} Subjects Evaluated`}
                      {activeType === 'CA2' && `${caSummary.recordedCA2Count} of ${caSummary.totalSubjectsCount} Subjects Evaluated`}
                      {activeType === 'Combined' && `${caSummary.completedSubjectsCount} of ${caSummary.totalSubjectsCount} Subjects Fully Completed`}
                    </td>

                    {activeType === 'CA1' && (
                      <>
                        <td className="p-2 text-center text-blue-800 font-black">
                          {caSummary.totalCA1Score} / {caSummary.totalCA1Max}
                        </td>
                        <td className="p-2 text-center text-blue-700 font-black">
                          {caSummary.ca1Percentage !== null ? `${caSummary.ca1Percentage}%` : 'N/A'}
                        </td>
                        <td className="p-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getBadgeClass(caSummary.overallGrade)}`}>
                            {caSummary.overallGrade}
                          </span>
                        </td>
                        <td className="p-2 text-slate-700 font-medium text-[10.5px]">
                          {caSummary.overallRemark}
                        </td>
                      </>
                    )}

                    {activeType === 'CA2' && (
                      <>
                        <td className="p-2 text-center text-indigo-800 font-black">
                          {caSummary.totalCA2Score} / {caSummary.totalCA2Max}
                        </td>
                        <td className="p-2 text-center text-indigo-700 font-black">
                          {caSummary.ca2Percentage !== null ? `${caSummary.ca2Percentage}%` : 'N/A'}
                        </td>
                        <td className="p-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getBadgeClass(caSummary.overallGrade)}`}>
                            {caSummary.overallGrade}
                          </span>
                        </td>
                        <td className="p-2 text-slate-700 font-medium text-[10.5px]">
                          {caSummary.overallRemark}
                        </td>
                      </>
                    )}

                    {activeType === 'Combined' && (
                      <>
                        <td className="p-2 text-center text-emerald-800 font-black">
                          {caSummary.totalCombinedScore} / {caSummary.totalCombinedMax}
                        </td>
                        <td className="p-2 text-center text-emerald-700 font-black">
                          {caSummary.overallCAPercentage !== null ? `${caSummary.overallCAPercentage}%` : 'N/A'}
                        </td>
                        <td className="p-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getBadgeClass(caSummary.overallGrade)}`}>
                            {caSummary.overallGrade}
                          </span>
                        </td>
                        <td className="p-2 text-slate-700 font-medium text-[10.5px]">
                          {caSummary.overallRemark}
                        </td>
                      </>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 5. Continuous Assessment Normalized Summary Cards */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="border border-slate-200 rounded-md p-2 bg-slate-50 text-center">
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Total CA1 Score</span>
                <span className="text-xs font-black text-blue-900">
                  {caSummary.totalCA1Score} <span className="text-[10px] font-normal text-slate-500">/ {caSummary.totalCA1Max}</span>
                </span>
              </div>

              <div className="border border-slate-200 rounded-md p-2 bg-slate-50 text-center">
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Total CA2 Score</span>
                <span className="text-xs font-black text-indigo-900">
                  {caSummary.totalCA2Score} <span className="text-[10px] font-normal text-slate-500">/ {caSummary.totalCA2Max}</span>
                </span>
              </div>

              <div className="border border-slate-200 rounded-md p-2 bg-slate-50 text-center">
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Combined CA Score</span>
                <span className="text-xs font-black text-emerald-900">
                  {caSummary.totalCombinedScore} <span className="text-[10px] font-normal text-slate-500">/ {caSummary.totalCombinedMax}</span>
                </span>
              </div>

              <div className="border border-blue-200 rounded-md p-2 bg-blue-50 text-center">
                <span className="text-[9px] uppercase font-bold text-blue-700 block">Overall CA Normalized</span>
                <span className="text-xs font-black text-blue-900">
                  {caSummary.overallCAPercentage !== null ? `${caSummary.overallCAPercentage}%` : 'Provisional'}
                </span>
              </div>
            </div>

            {/* 6. Remarks & Endorsements */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="border border-slate-200 rounded-md p-2.5 bg-white">
                <span className="text-[9px] uppercase font-bold text-slate-500 block mb-1">
                  Class Teacher's Continuous Assessment Remarks
                </span>
                <p className="text-[10.5px] text-slate-700 italic m-0 min-h-[28px]">
                  "{remarksForm.teacherComment}"
                </p>
              </div>

              <div className="border border-slate-200 rounded-md p-2.5 bg-white">
                <span className="text-[9px] uppercase font-bold text-slate-500 block mb-1">
                  Head of School / Principal Endorsement
                </span>
                <p className="text-[10.5px] text-slate-700 italic m-0 min-h-[28px]">
                  "{remarksForm.principalComment}"
                </p>
              </div>
            </div>
          </div>

          {/* 7. Bottom Section: Signatures & Official Seal */}
          <div>
            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-300 text-center items-end">
              <div className="flex flex-col items-center">
                {remarksForm.teacherSignature ? (
                  <img
                    src={remarksForm.teacherSignature}
                    alt="Teacher Signature"
                    className="h-9 object-contain mb-1"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="h-9 border-b border-dashed border-slate-300 w-32 mb-1" />
                )}
                <div className="text-[10px] text-slate-800 font-bold">
                  {remarksForm.teacherName || 'Class Teacher'}
                </div>
                <div className="text-[8.5px] text-slate-500 uppercase tracking-wider">Class Teacher</div>
              </div>

              <div className="flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 mb-1">
                  <span className="text-[6.5px] uppercase font-black tracking-widest text-center leading-tight">
                    EDUCORE<br />VERIFIED
                  </span>
                </div>
                <div className="text-[8.5px] text-slate-500 uppercase tracking-wider">Official Stamp</div>
              </div>

              <div className="flex flex-col items-center">
                {remarksForm.principalSignature ? (
                  <img
                    src={remarksForm.principalSignature}
                    alt="Principal Signature"
                    className="h-9 object-contain mb-1"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="h-9 border-b border-dashed border-slate-300 w-32 mb-1" />
                )}
                <div className="text-[10px] text-slate-800 font-bold">
                  {branding.principal || 'Principal / Head of School'}
                </div>
                <div className="text-[8.5px] text-slate-500 uppercase tracking-wider">Head of School</div>
              </div>
            </div>

            <div className="mt-2 pt-1 border-t border-slate-100 text-[8px] text-slate-400 flex justify-between items-center">
              <span>Official Computer-Generated Continuous Assessment Transcript · EduCore School Portal</span>
              <span>Date Generated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
