import React from 'react';

export default function StatCard({
  title,
  value,
  subvalue,
  icon: Icon,
  badgeText,
  statusType = 'default',
  onClick
}) {
  const statusStyles = {
    verified: {
      border: 'border-[#D9DEE3] hover:border-[#527D70]',
      badge: 'text-[#527D70] bg-[#EBF2EE] border-[#D0E0D6]',
      iconColor: 'text-[#527D70] bg-[#EBF2EE]',
      valueColor: 'text-[#25364A]',
    },
    unverified: {
      border: 'border-[#D9DEE3] hover:border-[#C18A45]',
      badge: 'text-[#C18A45] bg-[#FAF4EB] border-[#F0DFCA]',
      iconColor: 'text-[#C18A45] bg-[#FAF4EB]',
      valueColor: 'text-[#25364A]',
    },
    contradiction: {
      border: 'border-[#F1D7D7] hover:border-[#B85C5C] bg-[#FCF8F8]',
      badge: 'text-[#B85C5C] bg-[#FBF2F2] border-[#F1D7D7] font-semibold',
      iconColor: 'text-[#B85C5C] bg-[#FBF2F2]',
      valueColor: 'text-[#25364A]',
    },
    telemetry: {
      border: 'border-[#D9DEE3] hover:border-[#7189A6]',
      badge: 'text-[#7189A6] bg-[#EFF4F9] border-[#D6E2EC]',
      iconColor: 'text-[#7189A6] bg-[#EFF4F9]',
      valueColor: 'text-[#25364A]',
    },
    default: {
      border: 'border-[#D9DEE3] hover:border-[#B5BDC6]',
      badge: 'text-[#697586] bg-[#F5F4EF] border-[#D9DEE3]',
      iconColor: 'text-[#697586] bg-[#F5F4EF]',
      valueColor: 'text-[#25364A]',
    },
  };

  const style = statusStyles[statusType] || statusStyles.default;

  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-lg bg-white border transition-all duration-150 shadow-card flex flex-col justify-between ${
        style.border
      } ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-sans font-medium text-[#697586]">
            {title}
          </span>
          <div className="mt-2 flex items-baseline space-x-2.5">
            <span className={`text-2xl font-bold font-mono tracking-tight ${style.valueColor}`}>
              {value}
            </span>
            {badgeText && (
              <span className={`text-xs font-sans px-2.5 py-0.5 rounded border ${style.badge}`}>
                {badgeText}
              </span>
            )}
          </div>
        </div>
        <div className={`p-2.5 rounded-lg ${style.iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {subvalue && (
        <div className="mt-4 pt-3 border-t border-[#EDF0F3] flex items-center justify-between text-xs text-[#697586]">
          <span className="truncate">{subvalue}</span>
        </div>
      )}
    </div>
  );
}
