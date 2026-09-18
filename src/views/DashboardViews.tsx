import { useStore } from '../store';
import { Card, Input, Label, Select, Button, Modal } from '../components/ui';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { useState } from 'react';
import { useToastStore } from '../store/toast';
import { isStudentInTeacherClasses } from '../lib/classUtils';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function getComponentMax(type: string, config: any) {
  if (type === 'CA 1') return config.ca1;
  if (type === 'CA 2') return config.ca2;
  if (type === 'Examination') return config.exam;
  return null;
}

export default function DashboardHome() {
  const { data, currentRole, currentUser, config } = useStore();
  
  const teacher = currentRole === 'teacher' 
    ? data.teachers.find(t => (t.id || '').trim().toLowerCase() === (currentUser?.id || '').trim().toLowerCase()) || (currentUser as any)
    : null;
  const teacherClasses = teacher?.classes || [];
  
  // Filter students: if teacher, only students in their classes
  const students = currentRole === 'teacher' 
    ? data.students.filter(s => isStudentInTeacherClasses(s.class, teacherClasses))
    : data.students;

  // Filter results: if student, only theirs. if teacher, only students in their classes.
  const results = currentRole === 'student' 
    ? data.results.filter(r => r.studentId === currentUser?.id)
    : currentRole === 'teacher'
    ? data.results.filter(r => {
        const student = data.students.find(s => s.id === r.studentId);
        return student && isStudentInTeacherClasses(student.class, teacherClasses);
      })
    : data.results;

  const chartData = {
    labels: data.subjects.length > 0 ? data.subjects : ['None'],
    datasets: [
      {
        label: 'Average %',
        data: data.subjects.length > 0 ? data.subjects.map(s => {
          const rs = results.filter(r => r.subject === s && getComponentMax(r.type, config));
          if (!rs.length) return 0;
          return Math.round(rs.reduce((a, r) => a + (r.scaled || 0) / (getComponentMax(r.type, config) || 1) * 100, 0) / rs.length);
        }) : [0],
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
        borderRadius: 8,
      }
    ]
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-[minmax(140px,auto)]">
      
      {/* Welcome Widget (spans 2 cols) */}
      <div className="col-span-1 md:col-span-2 bg-slate-900 rounded-[24px] p-6 text-white shadow-sm flex flex-col justify-center relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold mb-2 mt-0 text-white">Welcome back, {currentUser?.name || 'User'}</h2>
          <p className="text-slate-300 m-0">Here's your {currentRole} overview for today.</p>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
          <svg width="200" height="200" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>
      </div>

      {/* Stats Widgets */}
      {currentRole !== 'student' && (
        <div className="bg-white rounded-[24px] p-6 shadow-sm flex flex-col justify-center border border-slate-100">
          <span className="text-slate-500 font-medium mb-1">
            {currentRole === 'teacher' ? 'My Students' : 'Total Students'}
          </span>
          <h2 className="text-4xl font-extrabold text-slate-800 m-0">{students.length}</h2>
        </div>
      )}

      {currentRole === 'admin' && (
        <div className="bg-white rounded-[24px] p-6 shadow-sm flex flex-col justify-center border border-slate-100">
          <span className="text-slate-500 font-medium mb-1">Total Teachers</span>
          <h2 className="text-4xl font-extrabold text-slate-800 m-0">{data.teachers.length}</h2>
        </div>
      )}

      <div className="bg-indigo-50 rounded-[24px] p-6 shadow-sm flex flex-col justify-center text-indigo-900 border border-indigo-100">
        <span className="font-medium mb-1 opacity-80">Available Exams</span>
        <h2 className="text-4xl font-extrabold m-0">{data.exams.length}</h2>
      </div>

      {/* Chart Widget (spans full or 3 cols, and taller) */}
      <div className={`col-span-1 md:col-span-3 lg:col-span-3 row-span-2 bg-white rounded-[24px] p-6 shadow-sm border border-slate-100 ${currentRole === 'student' ? 'lg:col-span-2' : ''}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800 m-0">Performance Overview</h3>
        </div>
        <div className="h-[250px] w-full">
          <Bar 
            data={chartData} 
            options={{ 
              responsive: true, 
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { 
                y: { beginAtZero: true, max: 100, grid: { color: '#f1f5f9' } },
                x: { grid: { display: false } }
              }
            }} 
          />
        </div>
      </div>

      {currentRole === 'student' && (
        <div className="col-span-1 md:col-span-3 lg:col-span-2 row-span-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[24px] p-6 shadow-sm text-white overflow-hidden relative">
          <h3 className="text-lg font-bold m-0 mb-4 flex items-center gap-2">
            <span>🏆</span> XP Leaderboard
          </h3>
          <div className="flex flex-col gap-3 relative z-10">
            {data.students
              .map(s => {
                const xp = data.results
                  .filter(r => r.studentId === s.id)
                  .reduce((sum, r) => sum + (r.scaled || r.raw || 0), 0);
                return { ...s, xp };
              })
              .sort((a, b) => b.xp - a.xp)
              .slice(0, 5)
              .map((s, idx) => (
                <div key={s.id} className={`flex items-center justify-between p-3 rounded-xl ${s.id === currentUser?.id ? 'bg-white/20 font-bold border border-white/30' : 'bg-black/10'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black w-6 text-center opacity-80">#{idx + 1}</span>
                    {s.photo ? (
                      <img src={s.photo} alt={s.name} className="w-8 h-8 rounded-full object-cover bg-white/20" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                        {s.name.charAt(0)}
                      </div>
                    )}
                    <span className="truncate max-w-[120px]">{s.name.split(' ')[0]}</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono">
                    <span className="text-amber-300">⚡</span>
                    {Math.round(s.xp)} XP
                  </div>
                </div>
              ))}
          </div>
          <div className="absolute -right-10 -bottom-10 opacity-10 text-9xl">👑</div>
        </div>
      )}

      {/* Additional Stats */}
      <div className="bg-emerald-500 rounded-[24px] p-6 shadow-sm flex flex-col justify-center text-white">
        <span className="text-emerald-100 font-medium mb-1">Recorded Results</span>
        <h2 className="text-4xl font-extrabold m-0">{results.length}</h2>
      </div>

      <div className="bg-amber-100 rounded-[24px] p-6 shadow-sm flex flex-col justify-center text-amber-900 border border-amber-200">
        <span className="font-medium mb-1 opacity-80">Active Subjects</span>
        <h2 className="text-4xl font-extrabold m-0">{data.subjects.length}</h2>
      </div>
    </div>
  );
}

export function AnalyticsView() {
  const { data, config } = useStore();
  
  const chartData = {
    labels: data.subjects,
    datasets: [
      {
        label: 'Average %',
        data: data.subjects.map(s => {
          const rs = data.results.filter(r => r.subject === s && getComponentMax(r.type, config));
          if (!rs.length) return 0;
          return Math.round(rs.reduce((a, r) => a + (r.scaled || 0) / (getComponentMax(r.type, config) || 1) * 100, 0) / rs.length);
        }),
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
      }
    ]
  };

  return (
    <Card>
      <h3 className="mt-0 text-xl font-bold mb-4">Subject Performance</h3>
      <div className="h-[400px]">
        <Bar 
          data={chartData} 
          options={{ 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, max: 100 } }
          }} 
        />
      </div>
    </Card>
  );
}
