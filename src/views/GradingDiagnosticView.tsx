import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Input, Select, Modal } from '../components/ui';
import { ResultRepository } from '../lib/firestore/repositories/resultRepository';
import { evaluateAttempt, evaluateAnswer, calculateGradeAndRemark, formatOptionDisplay, formatTrueFalseDisplay } from '../lib/scoringEngine';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  Play,
  FileCheck,
  CheckCheck,
  Zap,
  Info,
  Layers,
  HelpCircle
} from 'lucide-react';

export default function GradingDiagnosticView() {
  const { data, schoolId, config, updateData, currentUser } = useStore();
  const showToast = useToastStore(s => s.showToast);

  const [selectedResultId, setSelectedResultId] = useState<string>('');
  const [filterExamId, setFilterExamId] = useState<string>('all');
  const [onlyDiscrepancies, setOnlyDiscrepancies] = useState<boolean>(false);
  const [isApplyingFix, setIsApplyingFix] = useState(false);
  const [isBatchFixing, setIsBatchFixing] = useState(false);

  // Live Simulator state
  const [simType, setSimType] = useState<'mcq' | 'true_false' | 'fill_blank' | 'diagram'>('true_false');
  const [simOptions, setSimOptions] = useState<string>('Option A | Option B | Option C | Option D');
  const [simCorrect, setSimCorrect] = useState<string>('true');
  const [simCandidate, setSimCandidate] = useState<string>('0');
  const [simResult, setSimResult] = useState<any>(null);

  // Analyze all results against current question bank/exam questions
  const analysisList = useMemo(() => {
    return (data.results || []).map(r => {
      const student = data.students.find(s => s.id === r.studentId);
      const exam = data.exams.find(e => String(e.id) === String(r.examId));
      const questions = exam?.questions || [];
      const submittedAnswers = r.answers || {};

      let evaluated = null;
      let hasDiscrepancy = false;
      let diffPoints = 0;

      if (questions.length > 0 && r.answers) {
        evaluated = evaluateAttempt(questions, submittedAnswers, config, r.type);
        hasDiscrepancy = evaluated.rawScore !== r.raw || evaluated.grade !== r.grade;
        diffPoints = evaluated.rawScore - r.raw;
      }

      return {
        result: r,
        student,
        exam,
        evaluated,
        hasDiscrepancy,
        diffPoints
      };
    });
  }, [data.results, data.students, data.exams, config]);

  const filteredAnalysis = useMemo(() => {
    return analysisList.filter(item => {
      if (filterExamId !== 'all' && String(item.result.examId) !== filterExamId) return false;
      if (onlyDiscrepancies && !item.hasDiscrepancy) return false;
      return true;
    });
  }, [analysisList, filterExamId, onlyDiscrepancies]);

  // Set default selected item
  const activeItem = useMemo(() => {
    if (selectedResultId) {
      return analysisList.find(a => String(a.result.id) === String(selectedResultId));
    }
    // Default to first item with discrepancy, or first item
    const withDisc = analysisList.find(a => a.hasDiscrepancy);
    return withDisc || analysisList[0];
  }, [analysisList, selectedResultId]);

  const totalDiscrepancies = useMemo(() => {
    return analysisList.filter(a => a.hasDiscrepancy).length;
  }, [analysisList]);

  // Fix single result
  const handleApplyFix = async (itemToFix: typeof activeItem) => {
    if (!itemToFix || !itemToFix.evaluated || !itemToFix.exam) return;
    setIsApplyingFix(true);
    const r = itemToFix.result;
    const evaluated = itemToFix.evaluated;

    try {
      const updatedRecord = {
        ...r,
        raw: evaluated.rawScore,
        rawMax: evaluated.rawMax,
        scaled: evaluated.scaledScore,
        max: evaluated.maxComponentMark,
        percentage: evaluated.percentage,
        grade: evaluated.grade,
        remark: evaluated.remark,
        gradingStatus: evaluated.gradingStatus as 'final' | 'pending_manual',
        breakdown: evaluated.breakdown.map(b => ({
          qIndex: b.qIndex,
          type: b.type,
          awardedMarks: b.awardedMarks,
          maxMarks: b.maxMarks,
          isCorrect: b.isCorrect,
          requiresManual: b.requiresManual
        })),
        gradedAt: new Date().toISOString(),
        finalizedBy: currentUser?.name || 'Grading Diagnostic Tool'
      };

      // 1. Update store
      updateData(draft => {
        const idx = draft.results.findIndex(x => String(x.id) === String(r.id));
        if (idx >= 0) {
          draft.results[idx] = updatedRecord;
        }
      });

      // 2. Persist to Firestore if schoolId is active
      if (schoolId) {
        await ResultRepository.recordGradedResult(schoolId, updatedRecord);
      }

      showToast(`Score corrected! ${r.raw}/${r.rawMax} (${r.grade}) → ${evaluated.rawScore}/${evaluated.rawMax} (${evaluated.grade})`);
    } catch (err: any) {
      console.error('Error applying score fix:', err);
      showToast(err.message || 'Error updating result');
    } finally {
      setIsApplyingFix(false);
    }
  };

  // Batch fix all discrepancies
  const handleBatchFix = async () => {
    const discrepancies = analysisList.filter(a => a.hasDiscrepancy && a.evaluated && a.exam);
    if (discrepancies.length === 0) {
      showToast('No grading discrepancies detected across any exams.');
      return;
    }

    setIsBatchFixing(true);
    let successCount = 0;

    try {
      for (const item of discrepancies) {
        const r = item.result;
        const evaluated = item.evaluated!;

        const updatedRecord = {
          ...r,
          raw: evaluated.rawScore,
          rawMax: evaluated.rawMax,
          scaled: evaluated.scaledScore,
          max: evaluated.maxComponentMark,
          percentage: evaluated.percentage,
          grade: evaluated.grade,
          remark: evaluated.remark,
          gradingStatus: evaluated.gradingStatus as 'final' | 'pending_manual',
          breakdown: evaluated.breakdown.map(b => ({
            qIndex: b.qIndex,
            type: b.type,
            awardedMarks: b.awardedMarks,
            maxMarks: b.maxMarks,
            isCorrect: b.isCorrect,
            requiresManual: b.requiresManual
          })),
          gradedAt: new Date().toISOString(),
          finalizedBy: currentUser?.name || 'Diagnostic Batch Fix'
        };

        updateData(draft => {
          const idx = draft.results.findIndex(x => String(x.id) === String(r.id));
          if (idx >= 0) draft.results[idx] = updatedRecord;
        });

        if (schoolId) {
          await ResultRepository.recordGradedResult(schoolId, updatedRecord).catch(console.warn);
        }
        successCount++;
      }

      showToast(`Successfully recalculated and corrected ${successCount} examination results!`);
    } catch (err: any) {
      console.error('Batch fix error:', err);
      showToast(err.message || 'Error executing batch fix');
    } finally {
      setIsBatchFixing(false);
    }
  };

  // Live simulation execution
  const runSimulation = () => {
    const opts = simOptions.split('|').map(s => s.trim()).filter(Boolean);
    let parsedCorrect: any = simCorrect;
    if (simType === 'true_false') {
      const lower = simCorrect.trim().toLowerCase();
      if (['true', '1', 't', 'yes'].includes(lower)) parsedCorrect = true;
      else if (['false', '0', 'f', 'no'].includes(lower)) parsedCorrect = false;
    } else if (simType === 'mcq' || simType === 'diagram') {
      const num = Number(simCorrect);
      if (Number.isInteger(num)) parsedCorrect = num;
    }

    let parsedCandidate: any = simCandidate;
    if (simType === 'true_false') {
      const lower = simCandidate.trim().toLowerCase();
      if (['0', 'true', 't', 'yes'].includes(lower)) parsedCandidate = 0; // Or true
      else if (['1', 'false', 'f', 'no'].includes(lower)) parsedCandidate = 1; // Or false
    } else if (simType === 'mcq' || simType === 'diagram') {
      const num = Number(simCandidate);
      if (Number.isInteger(num)) parsedCandidate = num;
    }

    const mockQuestion = {
      type: simType,
      q: 'Diagnostic Test Question',
      options: opts,
      ans: parsedCorrect,
      answer: String(simCorrect),
      answers: [String(simCorrect)],
      marks: 1
    };

    const res = evaluateAnswer(mockQuestion, parsedCandidate, opts);
    setSimResult(res);
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Authoritative Scoring Diagnostics
              </span>
              {totalDiscrepancies > 0 ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  {totalDiscrepancies} Discrepanc{totalDiscrepancies === 1 ? 'y' : 'ies'} Found
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  All Records Harmonized
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black m-0 text-white">Grading & Submission Logic Inspector</h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl m-0">
              Inspect candidate submissions side-by-side against authoritative question keys.
              Identifies evaluation anomalies, verifies percentage scaling, and synchronizes official letter grades.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {totalDiscrepancies > 0 && (
              <Button
                variant="primary"
                onClick={handleBatchFix}
                disabled={isBatchFixing}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                {isBatchFixing ? 'Recalculating...' : `Fix All ${totalDiscrepancies} Discrepancies`}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Left Selector List, Right Detailed Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Attempt Selector & Filters */}
        <div className="lg:col-span-4 bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="font-bold text-slate-800 text-base m-0 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              Submissions ({filteredAnalysis.length})
            </h2>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyDiscrepancies}
                onChange={e => setOnlyDiscrepancies(e.target.checked)}
                className="rounded text-indigo-600"
              />
              Show Discrepancies Only
            </label>
          </div>

          {/* Filter by Exam */}
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">Filter by Examination</label>
            <Select
              value={filterExamId}
              onChange={e => setFilterExamId(e.target.value)}
              className="text-xs w-full"
            >
              <option value="all">All Examinations</option>
              {data.exams.map(e => (
                <option key={e.id} value={String(e.id)}>{e.title} ({e.subject})</option>
              ))}
            </Select>
          </div>

          {/* Submissions List */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredAnalysis.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No assessment submissions match your active filter.
              </div>
            ) : (
              filteredAnalysis.map(item => {
                const isSelected = activeItem && String(activeItem.result.id) === String(item.result.id);
                const r = item.result;
                const stu = item.student;
                const exam = item.exam;
                const evalRes = item.evaluated;

                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedResultId(String(r.id))}
                    className={`p-3 rounded-lg border transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 shadow-sm'
                        : item.hasDiscrepancy
                        ? 'border-rose-300 bg-rose-50/40 hover:bg-rose-50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="font-bold text-sm text-slate-800">
                        {stu ? stu.name : r.studentId}
                      </div>
                      {item.hasDiscrepancy ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-300">
                          {item.diffPoints > 0 ? `+${item.diffPoints} Marks` : `${item.diffPoints} Marks`}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                          Verified
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                      {exam ? exam.title : r.subject} • {r.type}
                    </div>

                    <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-slate-100/80">
                      <div className="text-slate-600">
                        Stored: <span className="font-bold">{r.raw}/{r.rawMax}</span> ({r.grade || '—'})
                      </div>
                      {evalRes && (
                        <div className="font-bold text-indigo-700">
                          Calc: <span>{evalRes.rawScore}/{evalRes.rawMax}</span> ({evalRes.grade})
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Detailed Diagnostic Inspector */}
        <div className="lg:col-span-8 space-y-6">
          {activeItem ? (
            <>
              {/* Score Comparison Card */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100 mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 m-0">
                      {activeItem.student?.name || activeItem.result.studentId} — {activeItem.exam?.title || activeItem.result.subject}
                    </h2>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Class: {activeItem.student?.class || 'Primary 5'} • Subject: {activeItem.result.subject} • Type: {activeItem.result.type}
                    </div>
                  </div>

                  {activeItem.hasDiscrepancy ? (
                    <Button
                      variant="primary"
                      onClick={() => handleApplyFix(activeItem)}
                      disabled={isApplyingFix}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow flex items-center gap-1.5"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      {isApplyingFix ? 'Applying...' : 'Recalculate & Apply Fix'}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Grading Matches Authoritative Key
                    </div>
                  )}
                </div>

                {/* Side-by-side Score Matrix */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Stored State */}
                  <div className={`p-4 rounded-xl border ${activeItem.hasDiscrepancy ? 'bg-rose-50/60 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
                      <span>Stored in Database</span>
                      {activeItem.hasDiscrepancy && (
                        <span className="text-rose-600 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Miscalculated
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Raw Marks:</span>
                        <span className="font-bold text-slate-900">{activeItem.result.raw} / {activeItem.result.rawMax}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Percentage:</span>
                        <span className="font-bold text-slate-900">
                          {activeItem.result.percentage ?? (activeItem.result.rawMax > 0 ? Math.round((activeItem.result.raw / activeItem.result.rawMax) * 100) : 0)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Scaled Component:</span>
                        <span className="font-bold text-slate-900">
                          {activeItem.result.scaled !== null ? `${activeItem.result.scaled} / ${activeItem.result.max}` : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-200/60">
                        <span className="text-slate-600 font-medium">Letter Grade:</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-black ${
                          activeItem.result.grade === 'A' ? 'bg-emerald-100 text-emerald-800' :
                          activeItem.result.grade === 'B' ? 'bg-blue-100 text-blue-800' :
                          activeItem.result.grade === 'F' ? 'bg-rose-100 text-rose-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {activeItem.result.grade || '—'} ({activeItem.result.remark || '—'})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Recalculated State */}
                  <div className="p-4 rounded-xl border bg-emerald-50/60 border-emerald-200">
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2 flex items-center justify-between">
                      <span>Recalculated by Engine</span>
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Authoritative
                      </span>
                    </div>
                    {activeItem.evaluated ? (
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Raw Marks:</span>
                          <span className="font-extrabold text-emerald-950">
                            {activeItem.evaluated.rawScore} / {activeItem.evaluated.rawMax}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Percentage:</span>
                          <span className="font-extrabold text-emerald-950">
                            {activeItem.evaluated.percentage}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Scaled Component:</span>
                          <span className="font-extrabold text-emerald-950">
                            {activeItem.evaluated.scaledScore !== null
                              ? `${activeItem.evaluated.scaledScore} / ${activeItem.evaluated.maxComponentMark}`
                              : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-emerald-200/60">
                          <span className="text-slate-600 font-medium">Corrected Grade:</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-black ${
                            activeItem.evaluated.grade === 'A' ? 'bg-emerald-200 text-emerald-900' :
                            activeItem.evaluated.grade === 'B' ? 'bg-blue-200 text-blue-900' :
                            activeItem.evaluated.grade === 'F' ? 'bg-rose-200 text-rose-900' :
                            'bg-amber-200 text-amber-900'
                          }`}>
                            {activeItem.evaluated.grade} ({activeItem.evaluated.remark})
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 py-4 text-center">
                        Exam question definitions unavailable for automatic recalculation.
                      </div>
                    )}
                  </div>
                </div>

                {/* Discrepancy Callout */}
                {activeItem.hasDiscrepancy && activeItem.evaluated && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-3">
                    <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900 leading-relaxed">
                      <strong className="block text-sm text-amber-950 mb-0.5">Scoring Anomaly Detected:</strong>
                      Candidate achieved <span className="font-bold underline">{activeItem.evaluated.rawScore} of {activeItem.evaluated.rawMax} correct</span> ({activeItem.evaluated.percentage}%),
                      which corresponds to <span className="font-bold">Grade {activeItem.evaluated.grade} ({activeItem.evaluated.remark})</span>.
                      Previous stored mark was recorded as <span className="font-bold line-through">{activeItem.result.raw}/{activeItem.result.rawMax} (Grade {activeItem.result.grade})</span>.
                      Click <strong className="text-indigo-800">"Recalculate & Apply Fix"</strong> to synchronize this record in Firestore.
                    </div>
                  </div>
                )}
              </div>

              {/* Question-by-Question Matrix */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base m-0">Question Evaluation Breakdown</h3>
                    <p className="text-xs text-slate-500 m-0">
                      Inspect student's chosen answer against expected answer key for each question item.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-600">
                    {activeItem.evaluated?.breakdown.length || 0} Questions
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                        <th className="p-3 font-semibold w-12 text-center">#</th>
                        <th className="p-3 font-semibold w-24">Type</th>
                        <th className="p-3 font-semibold min-w-[180px]">Question</th>
                        <th className="p-3 font-semibold min-w-[140px]">Student Chosen</th>
                        <th className="p-3 font-semibold min-w-[140px]">Expected Answer</th>
                        <th className="p-3 font-semibold w-20 text-center">Score</th>
                        <th className="p-3 font-semibold min-w-[200px]">Diagnostic Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {activeItem.evaluated?.breakdown.map((item, idx) => {
                        return (
                          <tr
                            key={idx}
                            className={`hover:bg-slate-50 transition-colors ${
                              item.isCorrect ? 'bg-emerald-50/20' : 'bg-rose-50/20'
                            }`}
                          >
                            <td className="p-3 text-center font-bold text-slate-600">
                              {idx + 1}
                            </td>
                            <td className="p-3 text-slate-600 capitalize">
                              <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-semibold">
                                {item.type.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="p-3 font-medium text-slate-800">
                              {item.questionText}
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-slate-900">
                                {item.studentDisplay}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">
                                raw: {JSON.stringify(item.rawStudentAnswer)}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-indigo-900">
                                {item.correctDisplay}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">
                                key: {JSON.stringify(item.rawCorrectAnswer)}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              {item.isCorrect ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  +{item.awardedMarks}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800">
                                  <XCircle className="w-3 h-3 text-rose-600" />
                                  0
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-slate-600 text-[11px] leading-relaxed">
                              {item.explanation}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
              Select an examination submission from the left panel to inspect grading diagnostics.
            </div>
          )}

          {/* Interactive Simulation / Test Sandbox */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-800 text-base m-0 flex items-center gap-2">
                  <Play className="w-4 h-4 text-indigo-600" />
                  Live Answer Evaluation Simulator
                </h3>
                <p className="text-xs text-slate-500 m-0">
                  Test custom answer inputs against question key logic in real time.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Question Type</label>
                <Select
                  value={simType}
                  onChange={e => setSimType(e.target.value as any)}
                  className="text-xs w-full"
                >
                  <option value="true_false">True / False</option>
                  <option value="mcq">Multiple Choice (MCQ)</option>
                  <option value="diagram">Diagram Question</option>
                  <option value="fill_blank">Fill in the Blank</option>
                </Select>
              </div>

              {(simType === 'mcq' || simType === 'diagram') && (
                <div className="sm:col-span-3">
                  <label className="font-bold text-slate-700 block mb-1">Options (separated by |)</label>
                  <Input
                    value={simOptions}
                    onChange={e => setSimOptions(e.target.value)}
                    placeholder="Option A | Option B | Option C | Option D"
                    className="text-xs"
                  />
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">Expected Key (q.ans)</label>
                <Input
                  value={simCorrect}
                  onChange={e => setSimCorrect(e.target.value)}
                  placeholder="e.g. true, 1, Option B, huge"
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Candidate Chosen Answer</label>
                <Input
                  value={simCandidate}
                  onChange={e => setSimCandidate(e.target.value)}
                  placeholder="e.g. 0, true, 1, Option B"
                  className="text-xs"
                />
              </div>

              <div className="flex items-end">
                <Button
                  onClick={runSimulation}
                  className="w-full text-xs font-bold bg-indigo-600 text-white"
                >
                  Test Evaluation
                </Button>
              </div>
            </div>

            {simResult && (
              <div className={`p-4 rounded-xl border mt-3 flex items-start gap-3 ${
                simResult.isCorrect ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50 border-rose-300'
              }`}>
                {simResult.isCorrect ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="text-xs space-y-1">
                  <div className="font-bold text-sm text-slate-900">
                    Result: {simResult.isCorrect ? 'CORRECT (+1 Mark)' : 'INCORRECT (0 Marks)'}
                  </div>
                  <div className="text-slate-700">
                    <strong>Candidate Display:</strong> {simResult.studentDisplay} • <strong>Expected Display:</strong> {simResult.correctDisplay}
                  </div>
                  <div className="text-slate-600">
                    <strong>Logic Trace:</strong> {simResult.explanation}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
