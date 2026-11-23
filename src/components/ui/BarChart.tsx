'use client';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const PALETTE = ['#2563eb', '#10b981', '#f59e0b', '#ef4444'];

export default function BarChart({ labels, series, money = true }: { labels: string[]; series: { label: string; data: number[] }[]; money?: boolean }) {
  const fmt = (v: number) => (money ? `₱${v.toLocaleString('en-PH', { maximumFractionDigits: 0 })}` : v.toLocaleString('en-PH'));
  return (
    <div className="h-64">
      <Bar
        data={{ labels, datasets: series.map((s, i) => ({ ...s, backgroundColor: PALETTE[i % PALETTE.length], borderRadius: 4, maxBarThickness: 28 })) }}
        options={{
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(Number(c.raw))}` } } },
          scales: { y: { beginAtZero: true, ticks: { callback: (v) => fmt(Number(v)) } }, x: { grid: { display: false } } },
        }}
      />
    </div>
  );
}
