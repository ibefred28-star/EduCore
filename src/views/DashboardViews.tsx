import { useStore } from '../store';
import { Card, Input, Label, Select, Button, Modal } from '../components/ui';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { useState } from 'react';
import { useToastStore } from '../store/toast';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function getComponentMax(type: string, config: any) {
  if (type === 'CA 1') return config.ca1;
  if (type === 'CA 2') return config.ca2;
  if (type === 'Examination') return config.exam;
  return null;
}

export default function DashboardHome() {
  const { data, currentRole, currentUser, config } = useStore();
  
  const results = currentRole === 'student' 
    ? data.results.filter(r => r.studentId === currentUser?.id)
    : data.results;

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
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
      }
    ]
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-[15px]">
        <Card>
          <span className="text-slate-500">Students</span>
          <h2 className="text-3xl font-bold my-[6px]">{data.students.length}</h2>
        </Card>
        <Card>
          <span className="text-slate-500">Teachers</span>
          <h2 className="text-3xl font-bold my-[6px]">{data.teachers.length}</h2>
        </Card>
        <Card>
          <span className="text-slate-500">Exams</span>
          <h2 className="text-3xl font-bold my-[6px]">{data.exams.length}</h2>
        </Card>
        <Card>
          <span className="text-slate-500">Results</span>
          <h2 className="text-3xl font-bold my-[6px]">{results.length}</h2>
        </Card>
      </div>
      
      <Card className="mt-[18px]">
        <h3 className="mt-0 text-xl font-bold mb-4">Performance Overview</h3>
        <div className="h-[300px]">
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
    </>
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
