import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Card, Button, Input, Select, Label } from '../components/ui';
import { CLASS_OPTIONS } from '../constants';
import { isStudentInTeacherClasses } from '../lib/classUtils';
import { generateAssessmentId, validateCAScore } from '../lib/firestore/repositories/assessmentRepository';
import { AssessmentRecord, AssessmentType } from '../types';

interface StudentScoreInput {
  studentId: string;
  studentName: string;
  className: string;
  rawValue: string; // Keep raw string to preserve blanks vs "0"
  error?: string;
  previousScore?: number | null;
  status?: 'draft' | 'submitted' | 'locked';
  enteredBy?: string;
  updatedAt?: string;
}

export default function TeacherCAScoreEntry() {
  const { data, branding, currentUser, currentRole, saveBatchAssessments } = useStore();
  const showToast = useToastStore(s => s.showToast);

  const teacher = currentRole === 'teacher'
    ? data.teachers.find(t => (t.id || '').trim().toLowerCase() === (currentUser?.id || '').trim().toLowerCase()) || (currentUser as any)
    : null;
  const teacherPupils = teacher?.pupils || [];

  // Permissions: Determine assigned classes and subjects
  const assignedClasses = useMemo(() => {
    if (currentRole === 'admin' || currentRole === 'superadmin') {
      return CLASS_OPTIONS;
    }
    const tClasses = teacher?.classes || [];
    // If teacher has specific assigned pupils, also include their classes
    const pupilClasses = (data.students || [])
      .filter(s => teacherPupils.some(p => p.toLowerCase() === s.id.toLowerCase()))
      .map(s => s.class);
    const combined = Array.from(new Set([...tClasses, ...pupilClasses])).filter(Boolean);
    return combined.length > 0 ? combined : CLASS_OPTIONS;
  }, [currentRole, teacher, teacherPupils, data.students]);

  const assignedSubjects = useMemo(() => {
    if (currentRole === 'admin' || currentRole === 'superadmin') {
      return data.subjects;
    }
    const tSubjects = teacher?.subjects || [];
    return tSubjects.length > 0 ? tSubjects : data.subjects;
  }, [currentRole, teacher, data.subjects]);

  // Selections
  const [session, setSession] = useState('2026/2027');
  const [term, setTerm] = useState('First Term');
  const [selectedClass, setSelectedClass] = useState(assignedClasses[0] || 'Primary 5');
  const [selectedSubject, setSelectedSubject] = useState(assignedSubjects[0] || 'English');
  const [assessmentType, setAssessmentType] = useState<AssessmentType>('CA1');

  // Score states
  const [scores, setScores] = useState<Record<string, StudentScoreInput>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  // Sync default class and subject if assigned list changes
  useEffect(() => {
    if (assignedClasses.length > 0 && !assignedClasses.includes(selectedClass)) {
      setSelectedClass(assignedClasses[0]);
    }
  }, [assignedClasses, selectedClass]);

  useEffect(() => {
    if (assignedSubjects.length > 0 && !assignedSubjects.includes(selectedSubject)) {
      setSelectedSubject(assignedSubjects[0]);
    }
  }, [assignedSubjects, selectedSubject]);

  // Students in selected class
  const classStudents = useMemo(() => {
    return data.students.filter(s => {
      if (s.class !== selectedClass) return false;
      if (currentRole === 'teacher' && teacherPupils.length > 0) {
        const inTeacherClasses = isStudentInTeacherClasses(s.class, teacher?.classes);
        const inTeacherPupils = teacherPupils.some(p => p.toLowerCase() === s.id.toLowerCase());
        return inTeacherClasses || inTeacherPupils;
      }
      return true;
    });
  }, [data.students, selectedClass, currentRole, teacherPupils, teacher?.classes]);

  // Load existing scores from data.assessments
  useEffect(() => {
    const existingAssessments = data.assessments || [];
    const newScores: Record<string, StudentScoreInput> = {};
    let allLocked = true;
    let anyFound = false;

    classStudents.forEach(stu => {
      const docId = generateAssessmentId(stu.id, selectedSubject, assessmentType, session, term);
      const found = existingAssessments.find(a => a.id === docId);

      if (found) {
        anyFound = true;
        if (found.status !== 'locked') allLocked = false;
        newScores[stu.id] = {
          studentId: stu.id,
          studentName: stu.name,
          className: stu.class,
          rawValue: found.score !== null && found.score !== undefined ? String(found.score) : '',
          previousScore: found.score,
          status: found.status,
          enteredBy: found.updatedBy?.name || found.enteredBy?.name || 'Authorized Staff',
          updatedAt: found.updatedAt || found.enteredAt
        };
      } else {
        allLocked = false;
        newScores[stu.id] = {
          studentId: stu.id,
          studentName: stu.name,
          className: stu.class,
          rawValue: '',
          previousScore: null,
          status: 'draft'
        };
      }
    });

    setScores(newScores);
    setIsLocked(anyFound && allLocked);
    setSaveSuccessNotice(null);
  }, [classStudents, selectedSubject, assessmentType, session, term, data.assessments]);

  // Handle score input change
  const handleScoreChange = (studentId: string, val: string) => {
    if (isLocked && currentRole !== 'admin') {
      showToast('This assessment batch is locked. Contact School Administrator to modify.');
      return;
    }

    setScores(prev => {
      const current = prev[studentId];
      if (!current) return prev;

      let error: string | undefined = undefined;
      const trimmed = val.trim();

      if (trimmed !== '') {
        const num = Number(trimmed);
        if (isNaN(num)) {
          error = 'Must be a valid number';
        } else if (num < 0) {
          error = 'Score cannot be negative';
        } else if (num > 20) {
          error = 'Maximum score is 20';
        }
      }

      return {
        ...prev,
        [studentId]: {
          ...current,
          rawValue: val,
          error
        }
      };
    });
  };

  // Quick fill demo/sample scores for fast testing
  const handleAutoFillSample = () => {
    if (isLocked && currentRole !== 'admin') return;
    setScores(prev => {
      const updated = { ...prev };
      classStudents.forEach((stu, idx) => {
        // Diverse sample marks between 10 and 20
        const sampleScores = [16, 14, 18, 12, 19, 15, 17, 20];
        const val = String(sampleScores[idx % sampleScores.length]);
        updated[stu.id] = {
          ...updated[stu.id],
          rawValue: val,
          error: undefined
        };
      });
      return updated;
    });
    showToast('Class roster populated with illustrative test scores');
  };

  const handleClearAll = () => {
    if (isLocked && currentRole !== 'admin') return;
    setScores(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(k => {
        updated[k] = { ...updated[k], rawValue: '', error: undefined };
      });
      return updated;
    });
    showToast('Scores cleared from form (not yet saved to database)');
  };

  // Save batch scores
  const handleSaveBatch = async (targetStatus: 'submitted' | 'draft' = 'submitted') => {
    // 1. Validate all inputs
    let hasErrors = false;
    const recordsToSave: AssessmentRecord[] = [];
    const now = new Date().toISOString();
    const currentUserInfo = {
      id: currentUser?.id || 'staff',
      name: currentUser?.name || 'Teacher',
      email: currentUser?.email || undefined,
      role: currentRole || 'teacher'
    };

    classStudents.forEach(stu => {
      const entry = scores[stu.id];
      if (!entry) return;

      const raw = entry.rawValue.trim();
      if (raw === '') {
        // Unrecorded assessment: do NOT treat as zero, do not force error
        return;
      }

      const validation = validateCAScore(raw);
      if (!validation.isValid) {
        hasErrors = true;
        setScores(prev => ({
          ...prev,
          [stu.id]: {
            ...prev[stu.id],
            error: validation.errorMessage || 'Invalid score'
          }
        }));
      } else {
        const docId = generateAssessmentId(stu.id, selectedSubject, assessmentType, session, term);
        recordsToSave.push({
          id: docId,
          schoolId: useStore.getState().schoolId || 'demo',
          studentId: stu.id,
          studentName: stu.name,
          classId: selectedClass,
          subjectId: selectedSubject,
          academicSessionId: session,
          termId: term,
          assessmentType,
          score: validation.score!,
          maximumScore: 20,
          status: isLocked ? 'locked' : targetStatus,
          enteredBy: entry.enteredBy ? { name: entry.enteredBy, role: 'teacher' } : currentUserInfo,
          enteredAt: entry.updatedAt || now,
          updatedBy: currentUserInfo,
          updatedAt: now
        });
      }
    });

    if (hasErrors) {
      showToast('Please correct validation errors before saving (scores must be 0 - 20). Unsaved values retained.');
      return;
    }

    if (recordsToSave.length === 0) {
      showToast('No scores have been entered to save. Blank entries are preserved as unrecorded.');
      return;
    }

    setIsSaving(true);
    try {
      await saveBatchAssessments(recordsToSave);
      setSaveSuccessNotice(`Successfully saved ${recordsToSave.length} ${assessmentType} scores for ${selectedSubject} (${selectedClass})!`);
      showToast(`Saved ${recordsToSave.length} ${assessmentType} records to Firebase`);
    } catch (err: any) {
      console.error('Error saving assessments batch:', err);
      showToast('Error saving assessments. Please verify connection and retry.');
    } finally {
      setIsSaving(false);
    }
  };

  const scoreList = Object.values(scores) as StudentScoreInput[];
  const hasAnyErrors = scoreList.some(s => !!s.error);
  const recordedCount = scoreList.filter(s => s.rawValue.trim() !== '').length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Controls */}
      <Card className="border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-600"></span>
              <h2 className="text-xl font-bold text-slate-900 m-0">
                Continuous Assessment Entry ({assessmentType})
              </h2>
            </div>
            <p className="text-sm text-slate-500 m-0 mt-1">
              Record official pupil CA1 and CA2 marks (0 - 20 marks each). Distinguishes unrecorded marks from zero.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Max Obtainable: 20 Marks
            </span>
            {isLocked && (
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                🔒 Assessment Batch Locked
              </span>
            )}
          </div>
        </div>

        {/* Filter / Selector Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 pt-4">
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

          <div>
            <Label className="mt-0 font-semibold text-xs text-slate-700">Class</Label>
            <Select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
              {assignedClasses.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </Select>
          </div>

          <div>
            <Label className="mt-0 font-semibold text-xs text-slate-700">Subject</Label>
            <Select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
              {assignedSubjects.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </Select>
          </div>

          <div>
            <Label className="mt-0 font-semibold text-xs text-slate-700">Assessment Component</Label>
            <div className="flex rounded-md overflow-hidden border border-slate-300">
              <button
                type="button"
                onClick={() => setAssessmentType('CA1')}
                className={`flex-1 py-2 text-xs font-bold transition ${assessmentType === 'CA1' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
              >
                CA 1 (20)
              </button>
              <button
                type="button"
                onClick={() => setAssessmentType('CA2')}
                className={`flex-1 py-2 text-xs font-bold transition ${assessmentType === 'CA2' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
              >
                CA 2 (20)
              </button>
            </div>
          </div>
        </div>

        {/* Quick Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-4 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-4">
            <span>Roster: <strong>{classStudents.length}</strong> Pupils</span>
            <span>Recorded: <strong className="text-emerald-700">{recordedCount}</strong></span>
            <span>Unrecorded: <strong className="text-amber-700">{classStudents.length - recordedCount}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleAutoFillSample} className="text-xs py-1.5 px-3">
              ⚡ Demo Auto-Fill
            </Button>
            <Button variant="secondary" onClick={handleClearAll} className="text-xs py-1.5 px-3">
              Clear Entries
            </Button>
            {currentRole === 'admin' && (
              <Button 
                variant="secondary" 
                onClick={() => setIsLocked(!isLocked)} 
                className="text-xs py-1.5 px-3 text-rose-700 border-rose-300 hover:bg-rose-50"
              >
                {isLocked ? '🔓 Unlock Batch' : '🔒 Lock Batch'}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Confirmation Notification */}
      {saveSuccessNotice && (
        <div className="p-3 px-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">✓</span>
            <span className="font-semibold">{saveSuccessNotice}</span>
          </div>
          <button 
            onClick={() => setSaveSuccessNotice(null)} 
            className="text-emerald-600 hover:text-emerald-800 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Class Roster Batch Entry Table */}
      <Card className="border border-slate-200 shadow-xs p-0 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 m-0">
              {selectedClass} · {selectedSubject} · {assessmentType} Roster
            </h3>
            <p className="text-xs text-slate-500 m-0 mt-0.5">
              Enter each pupil's score out of 20. Leave blank if unrecorded. Zero (0) is recorded as a scored zero.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              onClick={() => handleSaveBatch('submitted')} 
              disabled={isSaving || hasAnyErrors || classStudents.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2 shadow-xs"
            >
              {isSaving ? 'Saving to Firebase...' : `Save ${assessmentType} Scores`}
            </Button>
          </div>
        </div>

        {classStudents.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p className="text-base font-medium">No students registered in {selectedClass}.</p>
            <p className="text-xs mt-1">Please add students to this class in the Students directory.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <th className="p-3 w-12 text-center">#</th>
                  <th className="p-3 w-28">Pupil ID</th>
                  <th className="p-3">Pupil Full Name</th>
                  <th className="p-3 w-52">{assessmentType} Score (/20)</th>
                  <th className="p-3 w-32 text-center">Status</th>
                  <th className="p-3 w-48">Audit Trail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {classStudents.map((stu, idx) => {
                  const entry = scores[stu.id] || { rawValue: '', studentId: stu.id, studentName: stu.name, className: stu.class };
                  const isUnrecorded = entry.rawValue.trim() === '';
                  const hasErr = !!entry.error;
                  const numScore = !isUnrecorded && !hasErr ? Number(entry.rawValue) : null;

                  return (
                    <tr key={stu.id} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                      <td className="p-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                      <td className="p-3 font-mono font-medium text-slate-700">{stu.id}</td>
                      <td className="p-3 font-semibold text-slate-900">
                        {stu.name}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-600 text-xs">{assessmentType}:</span>
                          <div className="relative w-28">
                            <input
                              type="number"
                              min="0"
                              max="20"
                              step="0.5"
                              disabled={isLocked && currentRole !== 'admin'}
                              placeholder="Unrecorded"
                              value={entry.rawValue}
                              onChange={e => handleScoreChange(stu.id, e.target.value)}
                              className={`w-full px-2.5 py-1.5 text-sm font-bold text-center rounded border transition focus:outline-none focus:ring-2 ${
                                hasErr
                                  ? 'border-rose-400 bg-rose-50 text-rose-800 focus:ring-rose-200'
                                  : isUnrecorded
                                  ? 'border-slate-300 bg-slate-50 text-slate-400 focus:ring-blue-200 focus:bg-white focus:text-slate-900'
                                  : 'border-slate-300 bg-white text-slate-900 focus:ring-blue-200'
                              }`}
                            />
                          </div>
                          <span className="text-slate-500 font-bold text-xs">/ 20</span>
                        </div>

                        {/* Instant Inline Validation Feedback */}
                        {hasErr && (
                          <p className="text-[11px] text-rose-600 font-medium m-0 mt-1">
                            ⚠️ {entry.error}
                          </p>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {isUnrecorded ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            Unrecorded
                          </span>
                        ) : numScore === 0 ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            Scored 0 / 20
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Recorded: {numScore} / 20 ({Math.round((numScore! / 20) * 100)}%)
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-[11px] text-slate-500">
                        {entry.enteredBy ? (
                          <div>
                            <span className="font-medium text-slate-700">{entry.enteredBy}</span>
                            {entry.updatedAt && (
                              <div className="text-[10px] text-slate-400">
                                {new Date(entry.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not yet recorded</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Rules: Continuous Assessment components contribute <strong>20 marks</strong> each (Combined: <strong>40 marks</strong>).
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => handleSaveBatch('submitted')}
              disabled={isSaving || hasAnyErrors || classStudents.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-2 shadow-xs"
            >
              {isSaving ? 'Saving to Firebase...' : `Save ${assessmentType} Scores for ${selectedClass}`}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
