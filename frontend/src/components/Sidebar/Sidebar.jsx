import React from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  GitCommit,
  AlertTriangle,
  Activity,
  FileText,
  ShieldCheck,
  Cpu,
  Crosshair,
  Lock
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, badge: null },
  { id: 'evidence', label: 'Evidence Upload', icon: UploadCloud, badge: '7 sources' },
  { id: 'timeline', label: 'Timeline Reconstruction', icon: GitCommit, badge: '10 events' },
  { id: 'contradictions', label: 'Contradiction Analysis', icon: AlertTriangle, badge: '3 flags', badgeColor: 'text-[#B85C5C] bg-[#FBF2F2] border-[#F1D7D7]' },
  { id: 'trajectory', label: 'Vehicle Trajectory', icon: Activity, badge: '3 tracks' },
  { id: 'reports', label: 'Investigation Reports', icon: FileText, badge: 'Export' },
];

export default function Sidebar({
  activeTab,
  setActiveTab,
  currentIncident,
  evidenceCount,
  timelineCount,
  contradictionsCount
}) {
  return (
    <aside className="w-72 bg-white border-r border-[#D9DEE3] flex flex-col justify-between select-none z-20 shrink-0">
      {/* Brand Header */}
      <div>
        <div className="h-16 px-6 border-b border-[#D9DEE3] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-md bg-[#EBF2EE] border border-[#D0E0D6] flex items-center justify-center text-[#527D70]">
              <Crosshair className="w-4 h-4 text-[#527D70]" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold tracking-tight text-[#25364A] font-sans text-sm">
                  TRACE AI
                </span>
                <span className="text-xs font-sans font-medium px-1.5 py-0.5 rounded bg-[#F5F4EF] text-[#697586] border border-[#D9DEE3]">
                  Demo
                </span>
              </div>
              <p className="text-xs text-[#697586] tracking-normal font-sans">
                Accident Context Engine
              </p>
            </div>
          </div>
          <div title="Simulated read-only demo session" className="text-[#527D70]">
            <Lock className="w-4 h-4" />
          </div>
        </div>

        {/* Active Incident Summary Card */}
        <div className="p-4 mx-4 mt-4 rounded-lg border border-[#D9DEE3] bg-[#FAFAF8] text-xs">
          <div className="flex items-center justify-between text-[#697586] pb-2 border-b border-[#EDF0F3]">
            <span className="font-medium text-xs">Active incident</span>
            <span className="text-[#527D70] font-medium text-xs flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#527D70]"></span>
              Simulated case
            </span>
          </div>
          <div className="mt-2 text-[#25364A] font-semibold font-mono text-xs truncate" title={currentIncident?.id}>
            {currentIncident?.id || 'INC-2026-0884'}
          </div>
          <div className="text-xs text-[#697586] truncate mt-1 leading-snug" title={currentIncident?.title}>
            {currentIncident?.title || 'I-95 Multi-Vehicle Crash'}
          </div>
          <div className="mt-2.5 pt-2 border-t border-[#EDF0F3] flex items-center justify-between text-xs">
            <span className="text-[#697586]">Model consistency</span>
            <span className="text-[#527D70] font-bold font-mono">
              {currentIncident?.reconstructionConfidence || 94.2}%
            </span>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="p-4 space-y-1">
          <div className="px-3 pt-2 pb-1.5 text-xs font-semibold tracking-wide text-[#8A96A6]">
            Investigation modules
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-md text-xs transition-colors duration-150 font-medium text-left ${
                  isActive
                    ? 'bg-[#EBF2EE] text-[#25364A] font-semibold border-l-4 border-[#527D70] border-y border-r border-[#D0E0D6]'
                    : 'text-[#697586] hover:text-[#25364A] hover:bg-[#F5F4EF] border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-[#527D70]' : 'text-[#7189A6]'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {(item.badge || (item.id === 'evidence' && evidenceCount !== undefined) || (item.id === 'timeline' && timelineCount !== undefined) || (item.id === 'contradictions' && contradictionsCount !== undefined)) && (
                  <span
                    className={`text-xs font-mono px-2 py-0.5 rounded border shrink-0 ${
                      item.badgeColor || 'bg-white text-[#697586] border-[#D9DEE3]'
                    }`}
                  >
                    {item.id === 'evidence' && evidenceCount !== undefined
                      ? `${evidenceCount} sources`
                      : item.id === 'timeline' && timelineCount !== undefined
                      ? `${timelineCount} events`
                      : item.id === 'contradictions' && contradictionsCount !== undefined
                      ? `${contradictionsCount} flags`
                      : item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* System Engine Status Footer */}
      <div className="p-4 border-t border-[#D9DEE3] bg-[#FAFAF8] text-xs">
        <div className="flex items-center justify-between text-[#697586] mb-1.5">
          <span className="flex items-center gap-1.5 font-medium">
            <Cpu className="w-3.5 h-3.5 text-[#7189A6]" />
            <span>Processing pipeline</span>
          </span>
          <span className="text-[#527D70] font-mono font-medium">94% simulated</span>
        </div>
        <div className="w-full bg-[#E8EAE6] h-1.5 rounded-full overflow-hidden">
          <div className="bg-[#527D70] h-full rounded-full transition-all duration-300" style={{ width: '94%' }}></div>
        </div>
        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#EDF0F3] text-xs text-[#8A96A6]">
          <span>Synthetic demo data</span>
          <span className="text-[#527D70] font-medium flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#527D70]" />
            Mock verified
          </span>
        </div>
      </div>
    </aside>
  );
}
