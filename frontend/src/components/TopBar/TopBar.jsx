import React from 'react';
import {
  ChevronDown,
  Clock,
  ShieldCheck,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

export default function TopBar({
  incidents = [],
  selectedIncident,
  setSelectedIncident,
  onRefresh
}) {
  const safeIncidents = Array.isArray(incidents) ? incidents : [];

  const handleIncidentChange = (e) => {
    const found = safeIncidents.find((i) => i.id === e.target.value);
    if (found && typeof setSelectedIncident === 'function') {
      setSelectedIncident(found);
    }
  };

  const formattedTime = selectedIncident?.timestamp
    ? selectedIncident.timestamp.split(' ')[1] || selectedIncident.timestamp
    : '18:42:11 UTC';

  return (
    <header className="h-16 bg-white border-b border-[#D9DEE3] px-6 lg:px-8 flex items-center justify-between select-none shrink-0 z-10">
      {/* Incident Selector */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2.5">
          <span className="text-xs font-sans font-medium text-[#697586] bg-[#F5F4EF] px-2.5 py-1 rounded border border-[#D9DEE3]">
            Simulated case
          </span>
          <div className="relative">
            <select
              value={selectedIncident?.id || ''}
              onChange={handleIncidentChange}
              className="appearance-none bg-white hover:bg-[#FAFAF8] border border-[#D9DEE3] hover:border-[#B5BDC6] text-[#25364A] text-xs font-mono font-medium py-1.5 pl-3.5 pr-8 rounded-md transition focus:outline-none focus:ring-1 focus:ring-[#527D70] focus:border-[#527D70] cursor-pointer shadow-xs"
            >
              {safeIncidents.map((inc) => (
                <option key={inc.id} value={inc.id} className="bg-white text-[#25364A]">
                  {inc.id} — {(inc.title || '').slice(0, 40)}...
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#697586] absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Location & Time Subtext */}
        <div className="hidden lg:flex items-center space-x-3 text-xs text-[#697586] border-l border-[#D9DEE3] pl-4 font-sans">
          <span className="truncate max-w-sm text-[#25364A] font-medium">
            {selectedIncident?.location || 'Accident Site Investigation'}
          </span>
          <span className="text-[#D9DEE3]">|</span>
          <span className="flex items-center gap-1.5 text-[#697586] font-mono">
            <Clock className="w-3.5 h-3.5 text-[#7189A6]" />
            {formattedTime}
          </span>
        </div>
      </div>

      {/* Right Telemetry & Status Badges */}
      <div className="flex items-center space-x-3">
        {/* Analysis Status Indicator */}
        <div className="flex items-center space-x-2 bg-[#FAFAF8] border border-[#D9DEE3] px-3.5 py-1.5 rounded-md text-xs font-sans">
          <span className="w-2 h-2 rounded-full bg-[#527D70]"></span>
          <span className="text-[#697586]">Status:</span>
          <span className="text-[#527D70] font-medium">
            {selectedIncident?.status || 'Active Reconstruction'}
          </span>
          <span className="text-[#D9DEE3]">|</span>
          <span className="text-[#697586]">Time base:</span>
          <span className="text-[#25364A] font-mono text-xs">Simulated NTP</span>
        </div>

        {/* Evidence Chain Status */}
        <div className="hidden xl:flex items-center space-x-1.5 bg-[#EBF2EE] border border-[#D0E0D6] px-3 py-1.5 rounded-md text-xs text-[#527D70] font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-[#527D70]" />
          <span>Demo evidence ledger</span>
        </div>

        {/* Quick Refresh Button */}
        <button
          onClick={onRefresh}
          title="Recalibrate demonstration pipeline"
          className="p-2 rounded-md bg-white hover:bg-[#F5F4EF] text-[#697586] hover:text-[#25364A] border border-[#D9DEE3] transition shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        {/* Alert Indicator */}
        <div>
          <button
            title="3 simulated evidentiary contradictions"
            className="px-2.5 py-1.5 rounded-md bg-[#FBF2F2] hover:bg-[#F8E8E8] text-[#B85C5C] border border-[#F1D7D7] transition flex items-center gap-1.5 text-xs font-sans shadow-xs"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-[#B85C5C]" />
            <span className="font-semibold">3 contradictions</span>
          </button>
        </div>
      </div>
    </header>
  );
}
