import React from 'react';
import { History, ShieldCheck, Terminal, UserCheck } from 'lucide-react';

export default function ActivityAuditTrail({ activities = [] }) {
  const safeActivities = Array.isArray(activities) ? activities : [];

  const getIcon = (type) => {
    switch (type) {
      case 'SYSTEM_SYNC':
        return <Terminal className="w-3.5 h-3.5 text-[#7189A6]" />;
      case 'USER_FLAG':
        return <UserCheck className="w-3.5 h-3.5 text-[#C18A45]" />;
      case 'DATA_INGEST':
        return <ShieldCheck className="w-3.5 h-3.5 text-[#527D70]" />;
      default:
        return <History className="w-3.5 h-3.5 text-[#697586]" />;
    }
  };

  const getIconBg = (type) => {
    switch (type) {
      case 'SYSTEM_SYNC':
        return 'bg-[#EFF4F9] border-[#D6E2EC]';
      case 'USER_FLAG':
        return 'bg-[#FAF4EB] border-[#F0DFCA]';
      case 'DATA_INGEST':
        return 'bg-[#EBF2EE] border-[#D0E0D6]';
      default:
        return 'bg-[#F5F4EF] border-[#D9DEE3]';
    }
  };

  return (
    <div className="rounded-lg bg-white border border-[#D9DEE3] p-6 shadow-card">
      <div className="flex items-center justify-between pb-4 border-b border-[#EDF0F3]">
        <div className="flex items-center space-x-2.5">
          <History className="w-4 h-4 text-[#527D70]" />
          <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-[#25364A]">
            Audit trail & custody log
          </h3>
        </div>
        <span className="text-xs font-sans font-medium text-[#697586]">
          Simulated events
        </span>
      </div>

      <div className="mt-4 space-y-3.5">
        {safeActivities.map((item) => (
          <div
            key={item.id}
            className="flex items-start space-x-3.5 text-xs border-b border-[#EDF0F3] pb-3.5 last:border-b-0 last:pb-0"
          >
            <div className={`p-2 rounded-md border ${getIconBg(item.type)} mt-0.5 shrink-0`}>
              {getIcon(item.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-sans text-xs font-semibold text-[#25364A] truncate">
                  {item.action}
                </span>
                <span className="font-mono text-xs text-[#8A96A6] shrink-0 ml-2">
                  {item.timestamp}
                </span>
              </div>
              <p className="text-xs text-[#697586] mt-1 leading-relaxed font-sans">
                {item.details}
              </p>
              <div className="mt-1.5 flex items-center space-x-2 text-xs text-[#8A96A6] font-sans">
                <span>By: <strong className="text-[#25364A] font-medium">{item.user}</strong></span>
                <span>•</span>
                <span className="font-mono text-xs">{item.id}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
