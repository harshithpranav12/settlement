import React from 'react';
import { Layers, Video, MessageSquareQuote, Cpu } from 'lucide-react';

export default function EvidenceStats({ stats }) {
  const statItems = [
    {
      label: 'Total Evidence Items',
      value: stats.total || 0,
      sublabel: 'Aggregated case registry',
      icon: Layers,
      color: 'text-[#25364A]',
      iconBg: 'bg-[#F5F4EF] text-[#697586]'
    },
    {
      label: 'Video Evidence',
      value: stats.videos || 0,
      sublabel: 'Optical CCTV & dashcam files',
      icon: Video,
      color: 'text-[#7189A6]',
      iconBg: 'bg-[#EFF4F9] text-[#7189A6]'
    },
    {
      label: 'Witness Statements',
      value: stats.witnesses || 0,
      sublabel: 'Depositions & field interviews',
      icon: MessageSquareQuote,
      color: 'text-[#C18A45]',
      iconBg: 'bg-[#FAF4EB] text-[#C18A45]'
    },
    {
      label: 'Sensor Records',
      value: stats.sensors || 0,
      sublabel: 'CAN bus, EDR & telemetry CSVs',
      icon: Cpu,
      color: 'text-[#527D70]',
      iconBg: 'bg-[#EBF2EE] text-[#527D70]'
    }
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="p-5 rounded-lg bg-white border border-[#D9DEE3] shadow-card flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-sans font-medium text-[#697586]">
                    {item.label}
                  </span>
                  <div className="mt-2 flex items-baseline space-x-2">
                    <span className={`text-2xl font-bold font-mono tracking-tight ${item.color}`}>
                      {item.value}
                    </span>
                  </div>
                </div>
                <div className={`p-2.5 rounded-lg ${item.iconBg}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#EDF0F3] text-xs text-[#8A96A6]">
                {item.sublabel}
              </div>
            </div>
          );
        })}
      </div>

      {/* Origin & Pipeline Status Breakdown Strip */}
      <div className="p-3.5 rounded-lg bg-white border border-[#D9DEE3] shadow-card flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <span className="text-[#697586] font-medium uppercase tracking-wider text-[11px]">
            Evidence Origin:
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#EBF2EE] border border-[#D0E0D6] text-[#527D70] font-medium font-mono text-[11px]">
            <span>Actual Uploads:</span>
            <strong>{stats.actualUploads || 0}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#EFF4F9] border border-[#D6E2EC] text-[#7189A6] font-medium font-mono text-[11px]">
            <span>Preloaded Demo:</span>
            <strong>{stats.preloadedDemo || 0}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#FAF4EB] border border-[#F0DFCA] text-[#C18A45] font-medium font-mono text-[11px]">
            <span>Simulated Evidence:</span>
            <strong>{stats.simulated || 0}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[#697586] text-[11px]">Processing Queue:</span>
          <span className="px-2.5 py-1 rounded bg-[#FAF4EB] border border-[#F0DFCA] text-[#C18A45] font-medium font-mono text-[11px]">
            {stats.awaitingAnalysis || stats.total || 0} Awaiting Analysis
          </span>
        </div>
      </div>
    </div>
  );
}
