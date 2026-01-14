
import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  suffix?: string;
  description?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, suffix = '', description }) => {
  return (
    <div className="glass p-4 rounded-xl flex items-start space-x-4 transition-all hover:border-blue-500/50 group">
      <div className={`p-3 rounded-lg ${color} bg-opacity-10 text-xl`}>
        <i className={`fas ${icon} ${color.replace('bg-', 'text-')}`}></i>
      </div>
      <div className="flex-1">
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{label}</p>
        <div className="flex items-baseline space-x-1">
          <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
          <span className="text-slate-400 text-sm">{suffix}</span>
        </div>
        {description && <p className="text-slate-500 text-[10px] mt-1 italic">{description}</p>}
      </div>
    </div>
  );
};

export default StatCard;
