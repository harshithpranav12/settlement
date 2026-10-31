import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar/Sidebar';
import TopBar from './components/TopBar/TopBar';
import Dashboard from './components/Dashboard/Dashboard';
import EvidenceUpload from './components/EvidenceUpload/EvidenceUpload';
import TimelineReconstruction from './components/Timeline/TimelineReconstruction';
import ContradictionMatrix from './components/Contradictions/ContradictionMatrix';
import Reconstruction3D from './components/Reconstruction3D/Reconstruction3D';
import TrajectoryViewer from './components/Trajectory/TrajectoryViewer';
import InvestigationReport from './components/Reports/InvestigationReport';
import ForensicInvestigationReport from './components/Reconstruction3D/Report/ForensicInvestigationReport';
import WitnessAnalysisView from './components/AI/WitnessAnalysisView';
import InvestigatorAssistant from './components/AI/InvestigatorAssistant';
import apiService from './services/api';
import { INCIDENTS } from './data/mockData';
import { generateTimelineFromTelemetry } from './utils/telemetryTimelineEngine';
import { detectContradictions } from './utils/contradictionEngine';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [incidents, setIncidents] = useState(() => (Array.isArray(INCIDENTS) ? INCIDENTS : []));
  const [selectedIncident, setSelectedIncident] = useState(() => (Array.isArray(INCIDENTS) && INCIDENTS[0] ? INCIDENTS[0] : null));
  const [evidenceSources, setEvidenceSources] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [contradictions, setContradictions] = useState([]);
  const [trajectoryData, setTrajectoryData] = useState([]);
  const [pipelineStatus, setPipelineStatus] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportMode, setReportMode] = useState('forensic'); // 'forensic' | 'summary'
  const [isAssistantDrawerOpen, setIsAssistantDrawerOpen] = useState(false);

  useEffect(() => {
    window.__setActiveTab = setActiveTab;
    window.__setIsAssistantDrawerOpen = setIsAssistantDrawerOpen;
  }, []);

  // Initial Data Load via apiService
  useEffect(() => {
    let isMounted = true;
    async function initData() {
      try {
        setLoading(true);
        const incList = await apiService.getIncidents();
        const safeIncidents = Array.isArray(incList) ? incList : (Array.isArray(INCIDENTS) ? INCIDENTS : []);
        if (isMounted) {
          setIncidents(safeIncidents);
          const active = safeIncidents[0] || null;
          setSelectedIncident(active);
          if (active && active.id) {
            await loadIncidentDetails(active.id);
          }
        }
      } catch (err) {
        console.error('Failed to load forensic data:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    initData();
    return () => {
      isMounted = false;
    };
  }, []);

  // When selected incident changes
  const loadIncidentDetails = async (incidentId) => {
    try {
      const [evd, veh, tml, ctr, trj, pipe, act] = await Promise.all([
        apiService.getEvidenceSources(incidentId),
        apiService.getDetectedVehicles(incidentId),
        apiService.getTimelineEvents(incidentId),
        apiService.getContradictions(incidentId),
        apiService.getTrajectoryData(incidentId),
        apiService.getPipelineStatus(incidentId),
        apiService.getActivityLogs(incidentId),
      ]);
      setEvidenceSources(Array.isArray(evd) ? evd : []);
      setVehicles(Array.isArray(veh) ? veh : []);
      setTimelineEvents(Array.isArray(tml) ? tml : []);
      setContradictions(Array.isArray(ctr) ? ctr : []);
      setTrajectoryData(Array.isArray(trj) ? trj : []);
      setPipelineStatus(Array.isArray(pipe) ? pipe : []);
      setActivities(Array.isArray(act) ? act : []);
    } catch (err) {
      console.error('Error loading incident details:', err);
    }
  };

  const handleSelectIncident = async (incident) => {
    if (!incident) return;
    setSelectedIncident(incident);
    if (incident.id) {
      await loadIncidentDetails(incident.id);
    }
  };

  const handleCreateIncident = (newInc) => {
    if (!newInc) return;
    setIncidents((prev) => [newInc, ...prev]);
    setSelectedIncident(newInc);
    setEvidenceSources([]);
    setVehicles([]);
    setTimelineEvents([]);
    setContradictions([]);
    setTrajectoryData([]);
    setActiveTab('evidence');
  };

  const handleUploadEvidence = async (file, metadata) => {
    const newEvidence = await apiService.uploadEvidence(file, metadata);
    if (newEvidence) {
      setEvidenceSources((prev) => (Array.isArray(prev) ? [newEvidence, ...prev] : [newEvidence]));
    }
    return newEvidence;
  };

  const handleRefreshPipeline = async () => {
    if (selectedIncident && selectedIncident.id) {
      await loadIncidentDetails(selectedIncident.id);
    }
  };

  // Dynamically compute effective timeline events from uploaded telemetry
  const effectiveTimelineEvents = useMemo(() => {
    const generated = generateTimelineFromTelemetry(evidenceSources);
    if (generated && generated.length > 0) {
      return generated;
    }
    return Array.isArray(timelineEvents) ? timelineEvents : [];
  }, [evidenceSources, timelineEvents]);

  // Dynamically compute effective contradictions using deterministic cross-examination engine
  const effectiveContradictions = useMemo(() => {
    const detected = detectContradictions({
      evidenceSources,
      timelineEvents: effectiveTimelineEvents,
      vehicles,
      incident: selectedIncident
    });
    if (detected && detected.length > 0) {
      return detected;
    }
    return Array.isArray(contradictions) ? contradictions : [];
  }, [evidenceSources, effectiveTimelineEvents, vehicles, selectedIncident, contradictions]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#F5F4EF] flex items-center justify-center font-sans text-xs text-[#697586]">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#527D70] border-t-transparent rounded-full animate-spin"></div>
          <div className="tracking-wide text-[#25364A] font-medium">Loading TRACE AI Workstation...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-[#F5F4EF] text-[#25364A] overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentIncident={selectedIncident}
        evidenceCount={evidenceSources.length}
        timelineCount={effectiveTimelineEvents.length}
        contradictionsCount={effectiveContradictions.length}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Navigation Bar */}
        <TopBar
          incidents={Array.isArray(incidents) ? incidents : []}
          selectedIncident={selectedIncident}
          setSelectedIncident={handleSelectIncident}
          onCreateIncident={handleCreateIncident}
          onRefresh={handleRefreshPipeline}
          onNavigateTab={(tab) => setActiveTab(tab)}
          onToggleAssistant={() => setIsAssistantDrawerOpen((prev) => !prev)}
          contradictionsCount={effectiveContradictions.length}
        />

        {/* Scrollable View Content */}
        <main className="flex-1 overflow-y-auto bg-[#F5F4EF]">
          {activeTab === 'overview' && (
            <Dashboard
              incident={selectedIncident}
              incidents={Array.isArray(incidents) ? incidents : []}
              onSelectIncident={handleSelectIncident}
              onCreateIncidentClick={() => {
                const nextNum = Math.floor(Math.random() * 800 + 100);
                handleCreateIncident({
                  id: `INC-2026-0${nextNum}`,
                  title: 'New Incident Case Investigation',
                  location: 'Highway Intersection Sector',
                  timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
                  weather: 'Clear / Dry Surface / 18°C',
                  leadInvestigator: 'Accident Recon Unit',
                  status: 'Active Collection',
                  reconstructionConfidence: 0.0,
                  forensicLock: false,
                  totalVehicles: 0,
                  evidenceCount: 0,
                  timelineEventsCount: 0,
                  contradictionsCount: 0,
                  criticalFinding: 'Case initialized. Awaiting sensor telemetry ingestion.'
                });
              }}
              evidenceSources={Array.isArray(evidenceSources) ? evidenceSources : []}
              vehicles={Array.isArray(vehicles) ? vehicles : []}
              timelineEvents={effectiveTimelineEvents}
              contradictions={effectiveContradictions}
              pipelineStatus={Array.isArray(pipelineStatus) ? pipelineStatus : []}
              activities={Array.isArray(activities) ? activities : []}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'evidence' && (
            <EvidenceUpload
              incident={selectedIncident}
              evidenceSources={Array.isArray(evidenceSources) ? evidenceSources : []}
              setEvidenceSources={setEvidenceSources}
              onUploadEvidence={handleUploadEvidence}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'ai-intelligence' && (
            <WitnessAnalysisView
              incident={selectedIncident}
              timelineEvents={effectiveTimelineEvents}
              evidenceSources={Array.isArray(evidenceSources) ? evidenceSources : []}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'timeline' && (
            <TimelineReconstruction
              events={effectiveTimelineEvents}
              evidenceSources={Array.isArray(evidenceSources) ? evidenceSources : []}
              incident={selectedIncident}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'contradictions' && (
            <ContradictionMatrix
              contradictions={effectiveContradictions}
              incident={selectedIncident}
              evidenceSources={Array.isArray(evidenceSources) ? evidenceSources : []}
              timelineEvents={effectiveTimelineEvents}
              vehicles={Array.isArray(vehicles) ? vehicles : []}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'reconstruction3d' && (
            <Reconstruction3D
              evidenceSources={Array.isArray(evidenceSources) ? evidenceSources : []}
              timelineEvents={effectiveTimelineEvents}
              vehicles={Array.isArray(vehicles) ? vehicles : []}
              incident={selectedIncident}
              contradictions={effectiveContradictions}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'trajectory' && (
            <TrajectoryViewer
              trajectoryData={Array.isArray(trajectoryData) ? trajectoryData : []}
              vehicles={Array.isArray(vehicles) ? vehicles : []}
              incident={selectedIncident}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'reports' && (
            <div className="space-y-4">
              <div className="px-6 pt-4 pb-0 flex items-center justify-between print:hidden">
                <div className="flex items-center space-x-1 bg-[#E4E7EB] p-1 rounded-md text-xs font-medium">
                  <button
                    onClick={() => setReportMode('forensic')}
                    className={`px-3 py-1.5 rounded transition cursor-pointer ${
                      reportMode === 'forensic'
                        ? 'bg-white text-[#25364A] shadow-xs font-semibold'
                        : 'text-[#697586] hover:text-[#25364A]'
                    }`}
                  >
                    Forensic Investigation Report (Phase 5.5)
                  </button>
                  <button
                    onClick={() => setReportMode('summary')}
                    className={`px-3 py-1.5 rounded transition cursor-pointer ${
                      reportMode === 'summary'
                        ? 'bg-white text-[#25364A] shadow-xs font-semibold'
                        : 'text-[#697586] hover:text-[#25364A]'
                    }`}
                  >
                    Executive Summary Dossier (Phase 4)
                  </button>
                </div>
              </div>

              {reportMode === 'forensic' ? (
                <ForensicInvestigationReport
                  incident={selectedIncident}
                  evidenceSources={Array.isArray(evidenceSources) ? evidenceSources : []}
                  timelineEvents={effectiveTimelineEvents}
                  vehicles={Array.isArray(vehicles) ? vehicles : []}
                  contradictions={effectiveContradictions}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                />
              ) : (
                <InvestigationReport
                  incident={selectedIncident}
                  contradictions={effectiveContradictions}
                  vehicles={Array.isArray(vehicles) ? vehicles : []}
                  evidenceSources={Array.isArray(evidenceSources) ? evidenceSources : []}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Floating / Slide-Over AI Investigator Assistant Drawer */}
      {isAssistantDrawerOpen && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] z-50 shadow-2xl bg-white border-l border-[#D9DEE3] animate-in slide-in-from-right duration-200">
          <InvestigatorAssistant
            incident={selectedIncident}
            timelineEvents={effectiveTimelineEvents}
            evidenceSources={Array.isArray(evidenceSources) ? evidenceSources : []}
            contradictions={effectiveContradictions}
            isDrawer={true}
            onClose={() => setIsAssistantDrawerOpen(false)}
            onNavigateTab={(tab) => {
              setIsAssistantDrawerOpen(false);
              setActiveTab(tab);
            }}
          />
        </div>
      )}
    </div>
  );
}
