import React from 'react';
import GlassCard from './GlassCard';
import * as Icons from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  iconName: keyof typeof Icons;
  color: 'indigo' | 'purple' | 'pink' | 'emerald' | 'amber';
  description?: string;
  onClick?: () => void;
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  iconName,
  color,
  description,
  onClick,
}) => {
  const IconComponent = Icons[iconName] as React.ComponentType<{ className?: string }>;

  const colorStyles = {
    indigo: {
      text: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/20',
      glow: 'shadow-indigo-500/5',
    },
    purple: {
      text: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
      glow: 'shadow-purple-500/5',
    },
    pink: {
      text: 'text-pink-400',
      bg: 'bg-pink-500/10',
      border: 'border-pink-500/20',
      glow: 'shadow-pink-500/5',
    },
    emerald: {
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      glow: 'shadow-emerald-500/5',
    },
    amber: {
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      glow: 'shadow-amber-500/5',
    },
  };

  const style = colorStyles[color] || colorStyles.indigo;

  return (
    <GlassCard 
      onClick={onClick}
      className={`relative overflow-hidden border ${style.border} shadow-lg ${style.glow} ${
        onClick ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-300' : ''
      }`}
    >
      {/* Background Decorative Blur Circle */}
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full ${style.bg} blur-xl`} />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
            {title}
          </p>
          <h3 className="text-3xl font-extrabold text-white mt-1 tracking-tight">
            {value}
          </h3>
          {description && (
            <p className="text-gray-400 text-xs mt-2 font-medium">
              {description}
            </p>
          )}
        </div>

        <div className={`p-3 rounded-lg ${style.bg} ${style.text}`}>
          {IconComponent && <IconComponent className="w-6 h-6" />}
        </div>
      </div>
    </GlassCard>
  );
};

export default StatsCard;
