import React, { useState } from 'react';
import {
  ChevronDown,
  Clock,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Plus,
  X,
  FolderPlus,
  Sparkles
} from 'lucide-react';

export default function TopBar({
  incidents = [],
  selectedIncident,
  setSelectedIncident,
  onCreateIncident,
  onRefresh,
  onNavigateTab,
  onToggleAssistant,
  contradictionsCount = 3
}) {
  const safeIncidents = Array.isArray(incidents) ? incidents : [];
  const [showNewModal, setShowNewModal] = useState(false);

  // New incident form state
  const [caseId, setCaseId] = useState('');
  const [caseTitle, setCaseTitle] = useState('');
  const [caseLocation, setCaseLocation] = useState('');
  const [caseWeather, setCaseWeather] = useState('Clear / Dry Pavement / 18°C');
  const [caseInvestigator, setCaseInvestigator] = useState('Accident Reconstruction Investigator');
  const [formError, setFormError] = useState('');

  const handleIncidentChange = (e) => {
    const found = safeIncidents.find((i) => i.id === e.target.value);
    if (found && typeof setSelectedIncident === 'function') {
      setSelectedIncident(found);
    }
  };

  const handleOpenNewModal = () => {
    const nextNum = Math.floor(Math.random() * 800 + 100);
    setCaseId(`INC-2026-0${nextNum}`);
    setCaseTitle('');
    setCaseLocation('');
    setCaseWeather('Overcast / Wet Surface / 12°C');
    setCaseInvestigator('Agent Marcus Vance (Accident Recon Unit #7)');
    setFormError('');
    setShowNewModal(true);
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!caseTitle.trim()) {
      setFormError('Please enter an incident scenario title.');
      return;
    }
    if (!caseLocation.trim()) {
      setFormError('Please enter an incident location.');
      return;
    }

    const newInc = {
      id: caseId.trim() || `INC-2026-0${Math.floor(Math.random() * 800 + 100)}`,
      title: caseTitle.trim(),
      location: caseLocation.trim(),
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      weather: caseWeather.trim(),
      leadInvestigator: caseInvestigator.trim(),
      status: 'Active Collection',
      reconstructionConfidence: 0.0,
      forensicLock: false,
      totalVehicles: 0,
      evidenceCount: 0,
      timelineEventsCount: 0,
      contradictionsCount: 0,
      criticalFinding: 'Case initialized. Awaiting sensor telemetry ingestion.',
    };

    if (typeof onCreateIncident === 'function') {
      onCreateIncident(newInc);
    }
    setShowNewModal(false);
  };

  const formattedTime = selectedIncident?.timestamp
    ? selectedIncident.timestamp.split(' ')[1] || selectedIncident.timestamp
    : '18:42:11 UTC';

  return (
    <>
      <header className="h-16 bg-white border-b border-[#D9DEE3] px-6 lg:px-8 flex items-center justify-between select-none shrink-0 z-10 font-sans">
        {/* Incident Selector & New Case Button */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-sans font-medium text-[#697586] bg-[#F5F4EF] px-2.5 py-1 rounded border border-[#D9DEE3]">
              Simulated case
            </span>
            <div className="relative">
              <select
                value={selectedIncident?.id || ''}
                onChange={handleIncidentChange}
                className="appearance-none bg-white hover:bg-[#FAFAF8] border border-[#D9DEE3] hover:border-[#B5BDC6] text-[#25364A] text-xs font-mono font-medium py-1.5 pl-3 pr-8 rounded-md transition focus:outline-none focus:ring-1 focus:ring-[#527D70] focus:border-[#527D70] cursor-pointer shadow-xs max-w-[260px] sm:max-w-xs truncate"
              >
                {safeIncidents.map((inc) => (
                  <option key={inc.id} value={inc.id} className="bg-white text-[#25364A]">
                    {inc.id} — {(inc.title || '').slice(0, 32)}...
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#697586] absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            {/* Quick Create Incident Button */}
            <button
              onClick={handleOpenNewModal}
              title="Create new forensic incident case"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#FAF4EB] hover:bg-[#F3E7D5] text-[#C18A45] border border-[#F0DFCA] text-xs font-semibold transition cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Incident</span>
            </button>
          </div>

          {/* Location & Time Subtext */}
          <div className="hidden lg:flex items-center space-x-3 text-xs text-[#697586] border-l border-[#D9DEE3] pl-3.5 font-sans">
            <span className="truncate max-w-sm text-[#25364A] font-medium" title={selectedIncident?.location}>
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
          <div className="hidden md:flex items-center space-x-2 bg-[#FAFAF8] border border-[#D9DEE3] px-3 py-1.5 rounded-md text-xs font-sans">
            <span className="w-2 h-2 rounded-full bg-[#527D70]"></span>
            <span className="text-[#697586]">Status:</span>
            <span className="text-[#527D70] font-medium truncate max-w-[140px]">
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

          {/* AI Investigator Assistant Trigger */}
          <button
            type="button"
            onClick={() => {
              if (typeof onToggleAssistant === 'function') {
                onToggleAssistant();
              } else if (typeof onNavigateTab === 'function') {
                onNavigateTab('ai-intelligence');
              }
            }}
            title="Open AI Investigator Assistant (Featherless AI proxy)"
            className="px-2.5 py-1.5 rounded-md bg-[#FAF4EB] hover:bg-[#F3E7D5] text-[#C18A45] border border-[#F0DFCA] transition flex items-center gap-1.5 text-xs font-sans shadow-xs cursor-pointer font-medium"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#C18A45]" />
            <span className="font-semibold hidden sm:inline">AI Assistant</span>
          </button>

          {/* Quick Refresh Button */}
          <button
            onClick={onRefresh}
            title="Recalibrate demonstration pipeline"
            className="p-2 rounded-md bg-white hover:bg-[#F5F4EF] text-[#697586] hover:text-[#25364A] border border-[#D9DEE3] transition shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Alert Indicator — Navigates to Contradictions */}
          <div>
            <button
              onClick={() => typeof onNavigateTab === 'function' && onNavigateTab('contradictions')}
              title="Inspect detected evidentiary contradictions"
              className="px-2.5 py-1.5 rounded-md bg-[#FBF2F2] hover:bg-[#F8E8E8] text-[#B85C5C] border border-[#F1D7D7] transition flex items-center gap-1.5 text-xs font-sans shadow-xs cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-[#B85C5C]" />
              <span className="font-semibold">{contradictionsCount} contradictions</span>
            </button>
          </div>
        </div>
      </header>

      {/* New Incident Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-[#25364A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-[#D9DEE3] shadow-dropdown max-w-lg w-full p-6 space-y-5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#EDF0F3]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-[#FAF4EB] border border-[#F0DFCA] flex items-center justify-center text-[#C18A45]">
                  <FolderPlus className="w-4 h-4 text-[#C18A45]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#25364A]">Create New Forensic Incident</h3>
                  <p className="text-[11px] text-[#697586]">Initialize a new incident dossier in TRACE AI.</p>
                </div>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="p-1.5 rounded-md text-[#8A96A6] hover:text-[#25364A] hover:bg-[#F5F4EF] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-md bg-[#FBF2F2] border border-[#F1D7D7] text-xs text-[#B85C5C] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#697586] mb-1">
                    Incident Case ID
                  </label>
                  <input
                    type="text"
                    value={caseId}
                    onChange={(e) => setCaseId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-[#D9DEE3] font-mono text-xs text-[#25364A] focus:outline-none focus:border-[#527D70]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#697586] mb-1">
                    Lead Analyst
                  </label>
                  <input
                    type="text"
                    value={caseInvestigator}
                    onChange={(e) => setCaseInvestigator(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-[#D9DEE3] text-xs text-[#25364A] focus:outline-none focus:border-[#527D70]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-[#697586] mb-1">
                  Incident Title / Scenario Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. US-1 Southbound Multi-Car Intersection Collision"
                  value={caseTitle}
                  onChange={(e) => setCaseTitle(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-[#D9DEE3] text-xs text-[#25364A] focus:outline-none focus:border-[#527D70]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-[#697586] mb-1">
                  Location & Roadway Sector
                </label>
                <input
                  type="text"
                  placeholder="e.g. US-1 Southbound, Exit 9 Junction, Richmond Sector"
                  value={caseLocation}
                  onChange={(e) => setCaseLocation(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-[#D9DEE3] text-xs text-[#25364A] focus:outline-none focus:border-[#527D70]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-[#697586] mb-1">
                  Weather & Road Conditions
                </label>
                <input
                  type="text"
                  value={caseWeather}
                  onChange={(e) => setCaseWeather(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-[#D9DEE3] text-xs text-[#25364A] focus:outline-none focus:border-[#527D70]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-3.5 py-1.5 rounded-md border border-[#D9DEE3] text-[#697586] hover:text-[#25364A] hover:bg-[#F5F4EF] text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-md bg-[#527D70] hover:bg-[#43675C] text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Initialize Case & Upload Evidence
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
