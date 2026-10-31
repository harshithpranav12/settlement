import React from 'react';
import { FolderGit2, MapPin, Car, ChevronRight, Lock } from 'lucide-react';

export default function RecentIncidents({
  incidents = [],
  selectedIncident,
  onSelectIncident,
  onCreateIncidentClick
}) {
  const safeIncidents = Array.isArray(incidents) ? incidents : [];

  return (
    <div className="rounded-lg bg-white border border-[#D9DEE3] p-6 shadow-card">
      <div className="flex items-center justify-between pb-4 border-b border-[#EDF0F3]">
        <div className="flex items-center space-x-2.5">
          <FolderGit2 className="w-4 h-4 text-[#7189A6]" />
          <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-[#25364A]">
            Recent incident dossiers
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-sans font-medium text-[#697586]">
            {safeIncidents.length} cases
          </span>
          {typeof onCreateIncidentClick === 'function' && (
            <button
              onClick={onCreateIncidentClick}
              className="text-[11px] text-[#527D70] hover:text-[#43675C] font-semibold flex items-center gap-1 px-2 py-0.5 rounded border border-[#D0E0D6] bg-[#EBF2EE] hover:bg-[#DEEBE3] transition cursor-pointer"
              title="Create new incident case"
            >
              <span>+ New</span>
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {safeIncidents.map((incident) => {
          const isSelected = selectedIncident?.id === incident.id;
          return (
            <div
              key={incident.id}
              onClick={() => typeof onSelectIncident === 'function' && onSelectIncident(incident)}
              className={`p-3.5 rounded-lg border transition-all duration-150 cursor-pointer ${
                isSelected
                  ? 'bg-[#EBF2EE]/70 border-[#527D70] shadow-xs'
                  : 'bg-[#FAFAF8] border-[#D9DEE3] hover:border-[#B5BDC6] hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-semibold text-[#25364A]">
                    {incident.id}
                  </span>
                  <span className="text-xs font-sans px-2 py-0.5 rounded bg-white border border-[#D9DEE3] text-[#697586]">
                    {incident.status}
                  </span>
                  {incident.forensicLock && (
                    <span title="Simulated archived case" className="text-[#527D70]">
                      <Lock className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-1.5 text-xs font-mono font-medium text-[#527D70]">
                  <span>{incident.reconstructionConfidence}%</span>
                  <ChevronRight className="w-4 h-4 text-[#8A96A6]" />
                </div>
              </div>

              <h4 className="text-xs font-medium text-[#25364A] mt-2 truncate font-sans">
                {incident.title}
              </h4>

              <div className="mt-2.5 pt-2.5 border-t border-[#EDF0F3] flex items-center justify-between text-xs text-[#697586] font-sans">
                <span className="flex items-center gap-1.5 truncate max-w-[190px]">
                  <MapPin className="w-3.5 h-3.5 text-[#7189A6] shrink-0" />
                  <span className="truncate">{incident.location}</span>
                </span>
                <span className="flex items-center gap-1.5 shrink-0 font-mono text-xs">
                  <Car className="w-3.5 h-3.5 text-[#7189A6]" />
                  <span>{incident.totalVehicles || 0} veh</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
