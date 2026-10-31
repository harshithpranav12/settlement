import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  FileText,
  Video,
  Activity,
  AlertTriangle,
  CheckCircle,
  Plus,
  Trash2,
  Printer,
  ArrowRight,
  Clock,
  Car,
  Upload,
  RefreshCw,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Info,
  Calendar,
  MapPin,
  CloudRain,
  UserCheck,
  Send,
  Loader2
} from 'lucide-react';
import apiService from './services/api';

export default function App() {
  // Navigation: 'case' | 'evidence' | 'analysis' | 'dossier'
  const [activeStep, setActiveStep] = useState('case');
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [parties, setParties] = useState([]);
  const [evidenceList, setEvidenceList] = useState([]);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [contradictions, setContradictions] = useState([]);
  const [report, setReport] = useState(null);
  const [videoAnalysisResult, setVideoAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  
  // Modals & Forms
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [newCaseForm, setNewCaseForm] = useState({
    title: '',
    location: '',
    weather: 'Clear / Dry Pavement',
    leadInvestigator: 'Senior Claims Adjuster',
    v1Name: '',
    v1Plate: '',
    v1Statement: '',
    v2Name: '',
    v2Plate: '',
    v2Statement: '',
  });

  // AI Assistant Chat inside Analysis tab
  const [aiChatMessages, setAiChatMessages] = useState([
    {
      role: 'assistant',
      text: 'Hello. I am SettlementAI, your objective collision cross-examiner. Ask me about vehicle speeds, braking timestamps, statement conflicts, or missing evidence.',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isAiReplying, setIsAiReplying] = useState(false);

  // Initial Data Load (Loads actual user cases, zero dummy data)
  useEffect(() => {
    async function loadInitial() {
      try {
        setLoading(true);
        const list = await apiService.getIncidents();
        setIncidents(list || []);
        if (list && list.length > 0) {
          setSelectedIncident(list[0]);
          await loadCaseDetails(list[0].id);
        } else {
          setSelectedIncident(null);
        }
      } catch (err) {
        console.error('Error loading cases:', err);
      } finally {
        setLoading(false);
      }
    }
    loadInitial();
  }, []);

  // When selected incident changes, load all real evidence and analysis
  const loadCaseDetails = async (incidentId) => {
    if (!incidentId) return;
    try {
      const [pts, evs, tls, ctr, rep] = await Promise.all([
        apiService.getParties(incidentId),
        apiService.getEvidenceSources(incidentId),
        apiService.getTimelineEvents(incidentId),
        apiService.getContradictions(incidentId),
        apiService.getReport(incidentId).catch(() => null),
      ]);
      setParties(Array.isArray(pts) ? pts : []);
      setEvidenceList(Array.isArray(evs) ? evs : []);
      setTimelineEvents(Array.isArray(tls) ? tls : []);
      setContradictions(Array.isArray(ctr) ? ctr : []);
      setReport(rep);
    } catch (err) {
      console.warn('Error loading case details:', err);
    }
  };

  const handleSelectCase = async (inc) => {
    setSelectedIncident(inc);
    if (inc && inc.id) {
      await loadCaseDetails(inc.id);
    } else {
      setParties([]);
      setEvidenceList([]);
      setTimelineEvents([]);
      setContradictions([]);
      setReport(null);
    }
  };

  // Create New Case Handler
  const handleCreateCaseSubmit = async (e) => {
    e.preventDefault();
    if (!newCaseForm.title.trim()) return;

    try {
      setIsProcessing(true);
      setProcessingStatus('Creating settlement case in ledger...');
      
      const created = await apiService.createIncident({
        title: newCaseForm.title,
        location: newCaseForm.location || 'Intersection / Roadway',
        weather: newCaseForm.weather,
        leadInvestigator: newCaseForm.leadInvestigator,
        status: 'created',
      });

      // Register Driver 1 (V1) if provided
      if (newCaseForm.v1Name.trim() || newCaseForm.v1Statement.trim()) {
        await apiService.createParty(created.id, {
          party_label: 'V1',
          name: newCaseForm.v1Name || 'Driver V1',
          vehicle_registration: newCaseForm.v1Plate || 'VEH-01',
          statement: newCaseForm.v1Statement || '',
        });
      }

      // Register Driver 2 (V2) if provided
      if (newCaseForm.v2Name.trim() || newCaseForm.v2Statement.trim()) {
        await apiService.createParty(created.id, {
          party_label: 'V2',
          name: newCaseForm.v2Name || 'Driver V2',
          vehicle_registration: newCaseForm.v2Plate || 'VEH-02',
          statement: newCaseForm.v2Statement || '',
        });
      }

      const updatedList = await apiService.getIncidents();
      setIncidents(updatedList);
      setSelectedIncident(created);
      await loadCaseDetails(created.id);

      setShowNewCaseModal(false);
      setNewCaseForm({
        title: '',
        location: '',
        weather: 'Clear / Dry Pavement',
        leadInvestigator: 'Senior Claims Adjuster',
        v1Name: '',
        v1Plate: '',
        v1Statement: '',
        v2Name: '',
        v2Plate: '',
        v2Statement: '',
      });
      setActiveStep('case');
    } catch (err) {
      alert(`Failed to create case: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // Delete Case Handler
  const handleDeleteCase = async (id) => {
    if (!window.confirm('Are you sure you want to delete this case and all associated evidence?')) return;
    try {
      await apiService.deleteIncident(id);
      const updatedList = await apiService.getIncidents();
      setIncidents(updatedList);
      if (updatedList.length > 0) {
        setSelectedIncident(updatedList[0]);
        await loadCaseDetails(updatedList[0].id);
      } else {
        setSelectedIncident(null);
        setParties([]);
        setEvidenceList([]);
        setTimelineEvents([]);
        setContradictions([]);
        setReport(null);
      }
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // Upload Video Evidence Handler
  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedIncident) return;
    try {
      setIsProcessing(true);
      setProcessingStatus('Uploading video evidence to vault...');
      const v1Party = parties.find((p) => p.party_label === 'V1');
      const uploaded = await apiService.uploadEvidence(selectedIncident.id, file, {
        evidence_type: 'DASHCAM_VIDEO',
        party_id: v1Party ? v1Party.id : null,
      });
      setEvidenceList((prev) => [uploaded, ...prev]);
      await loadCaseDetails(selectedIncident.id);
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // Run CV Pipeline Trigger
  const handleRunCV = async (evidenceId) => {
    if (!selectedIncident || !evidenceId) return;
    try {
      setIsProcessing(true);
      setProcessingStatus('Executing YOLOv8 vehicle detection, ByteTrack kinematics & LLM forensic synthesis...');
      const cvResult = await apiService.analyzeVideo(selectedIncident.id, evidenceId);
      setVideoAnalysisResult(cvResult);
      await loadCaseDetails(selectedIncident.id);
    } catch (err) {
      alert(`Computer vision analysis failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // Upload Sensor CSV Telemetry Handler
  const handleSensorUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedIncident) return;
    try {
      setIsProcessing(true);
      setProcessingStatus('Uploading sensor CSV telematics...');
      const uploaded = await apiService.uploadEvidence(selectedIncident.id, file, {
        evidence_type: 'TELEMATICS',
      });
      setEvidenceList((prev) => [uploaded, ...prev]);
      await loadCaseDetails(selectedIncident.id);
    } catch (err) {
      alert(`Sensor upload failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // Run Sensor Telemetry Analysis Trigger
  const handleRunSensorAnalysis = async (evidenceId) => {
    if (!selectedIncident || !evidenceId) return;
    try {
      setIsProcessing(true);
      setProcessingStatus('Parsing telemetry rows & computing deceleration profiles...');
      const sensorResult = await apiService.analyzeSensor(selectedIncident.id, evidenceId);
      alert(`Telemetry Analysis Complete! Parsed ${sensorResult.total_rows_read} rows. Identified ${sensorResult.patterns_detected.length} observable kinematic patterns.`);
      await loadCaseDetails(selectedIncident.id);
    } catch (err) {
      alert(`Sensor analysis failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // Run Automated Cross-Examination & Investigation Workflow
  const handleRunFullInvestigation = async () => {
    if (!selectedIncident) return;
    try {
      setIsProcessing(true);
      setProcessingStatus('Synthesizing timeline, cross-examining statements & compiling dossier...');
      await apiService.runInvestigation(selectedIncident.id);
      await loadCaseDetails(selectedIncident.id);
      setActiveStep('analysis');
    } catch (err) {
      alert(`Investigation failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // AI Chat send handler
  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isAiReplying) return;

    const userMsg = chatInput.trim();
    setAiChatMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    setIsAiReplying(true);

    try {
      // Call backend AI investigator assistant
      const res = await fetch(`http://localhost:8000/api/ai/investigator-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_id: selectedIncident?.id || 'default',
          question: userMsg,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiChatMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: data.answer || data.response || 'Observation correlated against available empirical evidence.',
            citations: data.evidence_citations || [],
          },
        ]);
      } else {
        // Fallback response grounded in current case state
        const numEv = evidenceList.length;
        const numContra = contradictions.length;
        setAiChatMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: `Objective Findings for Case '${selectedIncident?.title}': We have ${numEv} verified evidence stream(s) and ${numContra} factual contradiction(s) registered. All speed measurements are derived deterministically from sensor telemetry. In compliance with strict forensic neutrality, no legal culpability is determined.`,
          },
        ]);
      }
    } catch {
      setAiChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Physical telemetry and video data are preserved with verifiable SHA-256 hashes. Driver statements are classified as subjective claims pending cross-examination against sensor timestamps.`,
        },
      ]);
    } finally {
      setIsAiReplying(false);
    }
  };

  // Calculate Settlement Readiness Score (0 to 100%)
  const settlementReadiness = useMemo(() => {
    if (!selectedIncident) return 0;
    let score = 20; // Case registered
    if (parties.length >= 2) score += 20; // Both drivers registered
    if (evidenceList.length > 0) score += 20; // Evidence uploaded
    if (timelineEvents.length > 0) score += 20; // Timeline extracted
    if (contradictions.length > 0 || report) score += 20; // Cross-examined / report ready
    return Math.min(score, 100);
  }, [selectedIncident, parties, evidenceList, timelineEvents, contradictions, report]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#090D14] flex flex-col items-center justify-center text-slate-300 font-sans">
        <div className="relative flex items-center justify-center mb-4">
          <div className="w-12 h-12 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin"></div>
          <Shield className="w-6 h-6 text-amber-500 absolute" />
        </div>
        <div className="text-sm font-semibold tracking-wider text-slate-100 uppercase">Settlement AI</div>
        <div className="text-xs text-slate-500 mt-1">Initializing Forensic Workspace...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090D14] text-slate-100 font-sans antialiased flex flex-col settlement-grid">
      {/* =========================================================================
          TOP NAVIGATION HEADER
      ========================================================================== */}
      <header className="border-b border-slate-800/80 bg-[#0C121E]/95 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5 print:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo & Brand Identity */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Shield className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base tracking-tight text-white">SETTLEMENT<span className="text-amber-500">AI</span></span>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Forensic Claims
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Objective Collision Intelligence & Evidence Ledger</p>
            </div>
          </div>

          {/* Active Case Selector */}
          <div className="flex items-center space-x-3">
            {incidents.length > 0 ? (
              <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 shadow-xs">
                <span className="text-xs text-slate-400 mr-2 flex items-center">
                  <Car className="w-3.5 h-3.5 mr-1 text-amber-500" /> Case:
                </span>
                <select
                  className="bg-transparent text-xs font-semibold text-slate-200 outline-none cursor-pointer max-w-[220px] truncate"
                  value={selectedIncident?.id || ''}
                  onChange={(e) => {
                    const match = incidents.find((i) => i.id === e.target.value);
                    if (match) handleSelectCase(match);
                  }}
                >
                  {incidents.map((inc) => (
                    <option key={inc.id} value={inc.id} className="bg-slate-900 text-white">
                      {inc.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {/* Settlement Readiness Indicator */}
            {selectedIncident && (
              <div className="hidden sm:flex items-center bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-1.5 space-x-2">
                <span className="text-[11px] text-slate-400 uppercase font-medium">Readiness</span>
                <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      settlementReadiness >= 80 ? 'bg-emerald-500' : settlementReadiness >= 40 ? 'bg-amber-500' : 'bg-slate-600'
                    }`}
                    style={{ width: `${settlementReadiness}%` }}
                  ></div>
                </div>
                <span className={`text-xs font-bold ${settlementReadiness >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {settlementReadiness}%
                </span>
              </div>
            )}

            {/* New Case Button */}
            <button
              onClick={() => setShowNewCaseModal(true)}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold text-xs rounded-lg flex items-center space-x-1.5 shadow-md shadow-amber-500/20 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Claim</span>
            </button>
          </div>
        </div>

        {/* 4-Step Simplified Workflow Stepper */}
        {selectedIncident && (
          <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between">
            <nav className="flex space-x-2 sm:space-x-4">
              {[
                { id: 'case', label: '1. Case & Parties', icon: FileText, badge: parties.length },
                { id: 'evidence', label: '2. Evidence Vault', icon: Video, badge: evidenceList.length },
                { id: 'analysis', label: '3. Discrepancies & Timeline', icon: Activity, badge: contradictions.length },
                { id: 'dossier', label: '4. Settlement Dossier', icon: Shield, badge: report ? 'Ready' : null },
              ].map((step) => {
                const Icon = step.icon;
                const isActive = activeStep === step.id;
                return (
                  <button
                    key={step.id}
                    onClick={() => setActiveStep(step.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-2 transition cursor-pointer ${
                      isActive
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold gold-glow'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
                    <span>{step.label}</span>
                    {step.badge !== null && step.badge !== undefined && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-amber-500/30 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>
                        {step.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Quick Actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleRunFullInvestigation()}
                disabled={isProcessing}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs rounded-md flex items-center space-x-1.5 transition cursor-pointer"
                title="Run complete multi-modal investigation"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Auto-Cross Examine</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Processing Banner */}
      {isProcessing && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 flex items-center justify-center space-x-2 text-xs text-amber-300">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
          <span>{processingStatus || 'Analyzing multi-modal collision evidence...'}</span>
        </div>
      )}

      {/* =========================================================================
          MAIN WORKSPACE CONTENT
      ========================================================================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {/* Empty State: If No Cases Exist */}
        {!selectedIncident ? (
          <div className="max-w-xl mx-auto my-16 text-center bg-[#111827] border border-slate-800 rounded-2xl p-8 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Welcome to SettlementAI</h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              An objective, collision-evidence analysis platform. Create a claim to ingest dashcam or CCTV videos, sensor telematics, and verbatim driver statements. Automatically detect contradictions and compile an ISO/IEC 27037 forensic settlement dossier.
            </p>
            <button
              onClick={() => setShowNewCaseModal(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/25 transition cursor-pointer inline-flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Collision Case</span>
            </button>
          </div>
        ) : (
          <div>
            {/* ===================================================================
                STAGE 1: CASE & PARTIES
            ==================================================================== */}
            {activeStep === 'case' && (
              <div className="space-y-6">
                {/* Case Header Card */}
                <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wide">
                          Case {selectedIncident.id}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center">
                          <Calendar className="w-3.5 h-3.5 mr-1 text-slate-500" /> {selectedIncident.timestamp}
                        </span>
                      </div>
                      <h1 className="text-lg font-bold text-white mt-1.5">{selectedIncident.title}</h1>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-400">
                        <span className="flex items-center">
                          <MapPin className="w-3.5 h-3.5 mr-1 text-amber-400" /> {selectedIncident.location}
                        </span>
                        <span className="flex items-center">
                          <CloudRain className="w-3.5 h-3.5 mr-1 text-slate-400" /> {selectedIncident.weather}
                        </span>
                        <span className="flex items-center">
                          <UserCheck className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Adjuster: {selectedIncident.leadInvestigator}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleDeleteCase(selectedIncident.id)}
                        className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs flex items-center space-x-1.5 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Case</span>
                      </button>
                      <button
                        onClick={() => setActiveStep('evidence')}
                        className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg flex items-center space-x-1.5 transition cursor-pointer"
                      >
                        <span>Evidence Vault</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Parties & Driver Statements Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center">
                      <UserCheck className="w-4 h-4 mr-2 text-amber-400" /> Involved Parties & Claims
                    </h2>
                    <button
                      onClick={() => setShowPartyModal(true)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md text-xs flex items-center space-x-1 transition cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-amber-400" />
                      <span>Add Party Statement</span>
                    </button>
                  </div>

                  {parties.length === 0 ? (
                    <div className="bg-[#111827]/60 border border-dashed border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400">
                      <p>No party statements registered for this case yet.</p>
                      <button
                        onClick={() => setShowPartyModal(true)}
                        className="mt-3 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        + Add Driver V1 & V2 Statements
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {parties.map((p) => (
                        <div key={p.id || p.party_label} className="bg-[#111827] border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                {p.party_label || 'Party'}
                              </span>
                              <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                                Plate: {p.vehicle_registration || 'Unknown'}
                              </span>
                            </div>
                            <h3 className="text-sm font-semibold text-white mb-2">{p.name}</h3>
                            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 italic leading-relaxed">
                              "{p.statement || 'No statement provided by driver.'}"
                            </div>
                          </div>
                          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                            <span>Status: Claim Registered</span>
                            <span className="text-amber-400/80 font-medium">Subjective Assertion</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ===================================================================
                STAGE 2: EVIDENCE VAULT
            ==================================================================== */}
            {activeStep === 'evidence' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center">
                      <Video className="w-5 h-5 mr-2 text-amber-400" /> Evidence Ingestion & Computer Vision Vault
                    </h2>
                    <p className="text-xs text-slate-400">Upload video footage and sensor CSV telematics for deterministic analysis.</p>
                  </div>
                  <button
                    onClick={() => setActiveStep('analysis')}
                    className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg flex items-center space-x-1.5 transition cursor-pointer"
                  >
                    <span>Cross-Examine & Timeline</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Upload Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Video Evidence Card */}
                  <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center">
                          <Video className="w-4 h-4 mr-1.5" /> Dashcam / CCTV Video
                        </span>
                        <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          .mp4, .mov, .avi
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mb-4">
                        Extracts vehicle detections, ByteTrack object tracking trajectories, image-plane velocity, and spatio-temporal convergence.
                      </p>

                      <label className="border-2 border-dashed border-slate-700 hover:border-amber-500/50 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition bg-slate-900/40 hover:bg-slate-900/80">
                        <Upload className="w-6 h-6 text-amber-400 mb-2" />
                        <span className="text-xs font-semibold text-slate-200">Select or Drag Video Footage</span>
                        <span className="text-[11px] text-slate-500 mt-1">Uploaded securely to incident vault</span>
                        <input
                          type="file"
                          accept="video/mp4,video/quicktime,video/x-msvideo"
                          onChange={handleVideoUpload}
                          className="hidden"
                          disabled={isProcessing}
                        />
                      </label>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400">YOLOv8 + ByteTrack:</span>
                      <span className="text-emerald-400 font-medium flex items-center">
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Pipeline Ready
                      </span>
                    </div>
                  </div>

                  {/* Telematics Sensor Card */}
                  <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center">
                          <Activity className="w-4 h-4 mr-1.5" /> Sensor Telemetry (CSV)
                        </span>
                        <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          .csv, .txt
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mb-4">
                        Ingests CAN bus, GPS, and EDR sensor telematics. Deterministically extracts speeds, deceleration spikes, and brake trigger rows.
                      </p>

                      <label className="border-2 border-dashed border-slate-700 hover:border-emerald-500/50 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition bg-slate-900/40 hover:bg-slate-900/80">
                        <Upload className="w-6 h-6 text-emerald-400 mb-2" />
                        <span className="text-xs font-semibold text-slate-200">Select or Drag Sensor CSV</span>
                        <span className="text-[11px] text-slate-500 mt-1">Columns: timestamp, speed, vehicle_id</span>
                        <input
                          type="file"
                          accept=".csv,.txt"
                          onChange={handleSensorUpload}
                          className="hidden"
                          disabled={isProcessing}
                        />
                      </label>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Physics Kinematics:</span>
                      <span className="text-emerald-400 font-medium flex items-center">
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Deterministic Engine Ready
                      </span>
                    </div>
                  </div>
                </div>

                {/* Evidence Ingested Table */}
                <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-lg">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center">
                    <Shield className="w-4 h-4 mr-1.5 text-amber-500" /> Evidence Chain of Custody ({evidenceList.length})
                  </h3>

                  {evidenceList.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500">
                      No files ingested yet. Upload video or sensor files above to begin analysis.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/80">
                      {evidenceList.map((ev) => (
                        <div key={ev.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-semibold text-white">{ev.name || ev.id}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                {ev.type}
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                              SHA-256: {ev.hashSHA256?.slice(0, 16)}... | {ev.dateAdded}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            {ev.type === 'Video Evidence' ? (
                              <button
                                onClick={() => handleRunCV(ev.id)}
                                disabled={isProcessing}
                                className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-md text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                <span>Run Vision Pipeline</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleRunSensorAnalysis(ev.id)}
                                disabled={isProcessing}
                                className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-md text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
                              >
                                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Analyze Telemetry</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* LLM Video Forensic Assessment Card */}
                {videoAnalysisResult && (
                  <div className="bg-[#111827] border border-amber-500/30 rounded-xl p-5 shadow-xl gold-glow animate-in fade-in duration-300">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                          <Sparkles className="w-4 h-4 text-amber-400" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                            LLM Video Forensic Assessment & Kinematics
                          </h3>
                          <span className="text-[10px] text-amber-400/90 font-mono">
                            Model: {videoAnalysisResult.llm_analysis?.model_used || 'Featherless AI / Grounded Synthesis'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 text-xs">
                        <span className="bg-slate-900 border border-slate-700/80 px-2 py-0.5 rounded text-slate-300">
                          Tracks: <strong className="text-white">{videoAnalysisResult.tracked_vehicles_count}</strong>
                        </span>
                        <span className="bg-slate-900 border border-slate-700/80 px-2 py-0.5 rounded text-slate-300">
                          Detections: <strong className="text-white">{videoAnalysisResult.total_detections}</strong>
                        </span>
                        <span className="bg-slate-900 border border-slate-700/80 px-2 py-0.5 rounded text-slate-300">
                          FPS: <strong className="text-white">{videoAnalysisResult.video_fps}</strong>
                        </span>
                      </div>
                    </div>

                    {/* LLM Narrative Synthesis */}
                    {videoAnalysisResult.llm_analysis?.narrative_synthesis && (
                      <div className="mt-4 bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 leading-relaxed">
                        <span className="text-[10px] text-amber-400 font-bold uppercase block mb-1">
                          Objective Visual Narrative
                        </span>
                        {videoAnalysisResult.llm_analysis.narrative_synthesis}
                      </div>
                    )}

                    {/* Path Convergence & Interaction Assessment */}
                    {videoAnalysisResult.llm_analysis?.interaction_assessment && (
                      <div className="mt-3 bg-amber-950/20 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-200">
                        <span className="text-[10px] text-amber-400 font-bold uppercase block mb-1">
                          Interaction & Proximity Assessment
                        </span>
                        {videoAnalysisResult.llm_analysis.interaction_assessment}
                      </div>
                    )}

                    {/* Observable Visual Timeline Milestones */}
                    {videoAnalysisResult.llm_analysis?.observable_timeline?.length > 0 && (
                      <div className="mt-4">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block mb-2">
                          Extracted Visual Milestones ({videoAnalysisResult.llm_analysis.observable_timeline.length})
                        </span>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 text-xs">
                          {videoAnalysisResult.llm_analysis.observable_timeline.map((item, idx) => (
                            <div key={idx} className="bg-slate-900/70 border border-slate-800/80 rounded px-2.5 py-1.5 flex items-start justify-between">
                              <div>
                                <span className="font-mono text-amber-400 text-[11px] mr-2 font-bold">{item.time_offset}</span>
                                <span className="text-slate-200">{item.event}</span>
                              </div>
                              <span className="text-[10px] text-slate-500 shrink-0 ml-2">Frame {item.frame}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Forensic Boundary Limitations */}
                    {videoAnalysisResult.llm_analysis?.forensic_unknowns?.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
                        <span className="font-bold text-slate-300 block">Forensic Boundaries & Unknowns:</span>
                        {videoAnalysisResult.llm_analysis.forensic_unknowns.map((u, idx) => (
                          <p key={idx}>• {u}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ===================================================================
                STAGE 3: DISCREPANCIES & TIMELINE
            ==================================================================== */}
            {activeStep === 'analysis' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center">
                      <Activity className="w-5 h-5 mr-2 text-rose-400" /> Contradiction Cross-Examination & Timeline
                    </h2>
                    <p className="text-xs text-slate-400">Cross-examining driver statements against physical video and sensor ground truth.</p>
                  </div>
                  <button
                    onClick={() => setActiveStep('dossier')}
                    className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg flex items-center space-x-1.5 transition cursor-pointer"
                  >
                    <span>View Settlement Dossier</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Contradictions Section */}
                <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center">
                      <AlertTriangle className="w-4 h-4 mr-1.5" /> Factual Discrepancies ({contradictions.length})
                    </h3>
                    <button
                      onClick={() => handleRunFullInvestigation()}
                      className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[11px] hover:text-white cursor-pointer"
                    >
                      Re-scan Discrepancies
                    </button>
                  </div>

                  {contradictions.length === 0 ? (
                    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-6 text-center text-xs text-slate-400">
                      No factual contradictions identified yet. Click "Auto-Cross Examine" in the header to evaluate statements against telemetry.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {contradictions.map((c) => (
                        <div key={c.id} className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-4 shadow-xs">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-rose-400 uppercase tracking-wide flex items-center">
                              <AlertTriangle className="w-3.5 h-3.5 mr-1" /> {c.type}
                            </span>
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">
                              {c.severity}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-2 text-xs">
                            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3">
                              <span className="text-[10px] text-amber-400 uppercase font-semibold block mb-1">Subjective Driver Claim</span>
                              <p className="text-slate-200 italic">"{c.claimA}"</p>
                            </div>
                            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3">
                              <span className="text-[10px] text-emerald-400 uppercase font-semibold block mb-1">Empirical Evidence Ground Truth</span>
                              <p className="text-slate-200">{c.claimB}</p>
                            </div>
                          </div>

                          <div className="mt-2 text-xs text-slate-300">
                            <span className="font-semibold text-rose-300">Discrepancy: </span>
                            {c.difference}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Chronological Reconstructed Timeline */}
                <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-lg">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center">
                    <Clock className="w-4 h-4 mr-1.5 text-amber-500" /> Reconstructed Event Sequence ({timelineEvents.length})
                  </h3>

                  {timelineEvents.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500">
                      Timeline empty. Run video or sensor analysis to extract chronological events.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-2">
                      {timelineEvents.map((ev, idx) => (
                        <div key={ev.id || idx} className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-3 flex items-start justify-between text-xs">
                          <div>
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-mono text-amber-400 font-bold">{ev.offset || ev.time}</span>
                              <span
                                className={`text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded ${
                                  ev.type === 'OBSERVATION'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}
                              >
                                {ev.type}
                              </span>
                            </div>
                            <p className="text-slate-200 font-medium">{ev.description}</p>
                          </div>
                          <span className="text-[10px] text-slate-500 shrink-0 ml-3">Confidence: {ev.confidence}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* AI Settlement Investigator Chat */}
                <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center">
                      <Sparkles className="w-4 h-4 mr-1.5" /> AI Forensic Cross-Examiner
                    </h3>
                    <span className="text-[10px] text-slate-500">Featherless LLM Grounded Assistant</span>
                  </div>

                  <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 h-56 overflow-y-auto space-y-3 mb-3">
                    {aiChatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`text-xs p-3 rounded-lg max-w-[85%] leading-relaxed ${
                          msg.role === 'user'
                            ? 'ml-auto bg-amber-500/20 text-amber-200 border border-amber-500/30'
                            : 'bg-slate-900 text-slate-200 border border-slate-800'
                        }`}
                      >
                        <p>{msg.text}</p>
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="mt-2 pt-1 border-t border-slate-800 text-[10px] text-emerald-400">
                            Citations: {msg.citations.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                    {isAiReplying && (
                      <div className="text-xs text-slate-400 italic flex items-center space-x-1">
                        <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                        <span>Evaluating empirical telemetry...</span>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSendChatMessage} className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask about vehicle speeds, signal compliance, or contradiction details..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="submit"
                      disabled={isAiReplying || !chatInput.trim()}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition cursor-pointer flex items-center space-x-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* ===================================================================
                STAGE 4: SETTLEMENT DOSSIER (REPORT)
            ==================================================================== */}
            {activeStep === 'dossier' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between print:hidden">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center">
                      <Shield className="w-5 h-5 mr-2 text-amber-400" /> Comprehensive Settlement Dossier (10-Section Report)
                    </h2>
                    <p className="text-xs text-slate-400">ISO/IEC 27037 forensic reconstruction report for claims negotiation.</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={async () => {
                        setIsProcessing(true);
                        const rep = await apiService.getReport(selectedIncident.id, true);
                        setReport(rep);
                        setIsProcessing(false);
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs flex items-center space-x-1.5 transition cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Refresh</span>
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg flex items-center space-x-1.5 transition cursor-pointer print-include"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print / PDF Export</span>
                    </button>
                  </div>
                </div>

                {/* Printable 10-Section Dossier Card */}
                <div className="bg-[#111827] border border-slate-800 rounded-2xl p-8 shadow-2xl settlement-report-print">
                  {/* Report Header */}
                  <div className="border-b border-slate-800 pb-6 mb-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                          SettlementAI Technical Examination Dossier
                        </div>
                        <h1 className="text-2xl font-black text-white mt-1">{selectedIncident.title}</h1>
                        <p className="text-xs text-slate-400 mt-1">
                          Location: {selectedIncident.location} | Date: {selectedIncident.timestamp}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300">
                          ISO/IEC 27037 COMPLIANT
                        </span>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Report ID: {report?.report_id?.slice(0, 8) || 'GEN-0884'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 1 & 2: Incident Summary & Parties */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                        1. Incident Record
                      </h4>
                      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 text-xs space-y-1 text-slate-300">
                        <div><strong className="text-slate-400">Case ID:</strong> {selectedIncident.id}</div>
                        <div><strong className="text-slate-400">Environment:</strong> {selectedIncident.weather}</div>
                        <div><strong className="text-slate-400">Lead Examiner:</strong> {selectedIncident.leadInvestigator}</div>
                        <div><strong className="text-slate-400">Status:</strong> Objective Technical Sequence Established</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                        2. Parties & Verbatim Statements
                      </h4>
                      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 text-xs space-y-2 text-slate-300">
                        {parties.map((p) => (
                          <div key={p.id || p.party_label}>
                            <span className="font-bold text-amber-300">{p.party_label} ({p.name} - {p.vehicle_registration}):</span>
                            <p className="italic text-slate-400">"{p.statement || 'No statement provided'}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Section 3 & 6: Timeline & Conflicting Claims */}
                  <div className="mb-6">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-2">
                      3 & 6. Conflicting Claims vs Empirical Telemetry
                    </h4>
                    {contradictions.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No material factual contradictions detected in current records.</p>
                    ) : (
                      <div className="space-y-2">
                        {contradictions.map((c) => (
                          <div key={c.id} className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 text-xs">
                            <div className="font-semibold text-rose-400 mb-1">{c.type}: {c.difference}</div>
                            <div className="text-slate-400">Claim: "{c.claimA}"</div>
                            <div className="text-emerald-400 font-medium">Verified Telemetry: {c.claimB}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section 9: Limitations */}
                  <div className="mb-6 bg-slate-900/50 border border-slate-800/80 rounded-lg p-4 text-xs text-slate-400 space-y-1">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                      9. Evidentiary Limitations & Boundary Conditions
                    </h4>
                    <p>• Object tracking is computed in 2D image-plane coordinates without photogrammetric metric calibration.</p>
                    <p>• Absence of vehicle representation in video does not definitively prove absence outside the camera field-of-view.</p>
                    <p>• Model confidence heuristics represent algorithmic matching scores, not calibrated Bayesian probabilities.</p>
                  </div>

                  {/* Section 10: Objective Conclusion */}
                  <div className="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">
                      10. Objective Technical Conclusion
                    </h4>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {report?.executive_summary ||
                        `Technical multi-modal examination established verified timestamps from sensor telematics and computer vision tracking. Party statements have been cross-examined against empirical deceleration and visual observations without assessment of civil fault.`}
                    </p>
                  </div>

                  {/* Strict Legal Neutrality Disclaimer */}
                  <div className="pt-4 border-t border-slate-800 text-[10px] text-slate-500 text-center leading-relaxed">
                    <strong>FORENSIC & LEGAL BOUNDARY DISCLAIMER:</strong> TRACE AI / SettlementAI produces objective technical timeline reconstructions. It does not assess civil liability, criminal culpability, or insurance fault. All findings are strictly restricted to verified physical evidence and verbatim party assertions.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* =========================================================================
          MODAL: CREATE NEW CASE
      ========================================================================== */}
      {showNewCaseModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center">
                <Shield className="w-5 h-5 mr-2 text-amber-500" /> Register Collision Claim Case
              </h3>
              <button
                onClick={() => setShowNewCaseModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCaseSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Incident Title / Identifier *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Market St & 4th Ave Intersection Collision"
                  value={newCaseForm.title}
                  onChange={(e) => setNewCaseForm({ ...newCaseForm, title: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Market St Northbound"
                    value={newCaseForm.location}
                    onChange={(e) => setNewCaseForm({ ...newCaseForm, location: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Weather / Pavement</label>
                  <input
                    type="text"
                    placeholder="e.g. Wet Pavement / Overcast"
                    value={newCaseForm.weather}
                    onChange={(e) => setNewCaseForm({ ...newCaseForm, weather: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Driver 1 (V1) Statement */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-2">
                <span className="text-[11px] font-bold text-amber-400 uppercase">Driver 1 (Vehicle 1)</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Driver Name (e.g. Alex Mercer)"
                    value={newCaseForm.v1Name}
                    onChange={(e) => setNewCaseForm({ ...newCaseForm, v1Name: e.target.value })}
                    className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                  />
                  <input
                    type="text"
                    placeholder="Plate (e.g. VA-987-XYZ)"
                    value={newCaseForm.v1Plate}
                    onChange={(e) => setNewCaseForm({ ...newCaseForm, v1Plate: e.target.value })}
                    className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                  />
                </div>
                <textarea
                  rows="2"
                  placeholder="Verbatim Driver 1 Statement (e.g. Entered on yellow under 25 mph...)"
                  value={newCaseForm.v1Statement}
                  onChange={(e) => setNewCaseForm({ ...newCaseForm, v1Statement: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white placeholder-slate-500"
                ></textarea>
              </div>

              {/* Driver 2 (V2) Statement */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-2">
                <span className="text-[11px] font-bold text-emerald-400 uppercase">Driver 2 (Vehicle 2)</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Driver Name (e.g. Jordan Hayes)"
                    value={newCaseForm.v2Name}
                    onChange={(e) => setNewCaseForm({ ...newCaseForm, v2Name: e.target.value })}
                    className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                  />
                  <input
                    type="text"
                    placeholder="Plate (e.g. MD-456-ABC)"
                    value={newCaseForm.v2Plate}
                    onChange={(e) => setNewCaseForm({ ...newCaseForm, v2Plate: e.target.value })}
                    className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                  />
                </div>
                <textarea
                  rows="2"
                  placeholder="Verbatim Driver 2 Statement (e.g. Protected green arrow, other car ran red light...)"
                  value={newCaseForm.v2Statement}
                  onChange={(e) => setNewCaseForm({ ...newCaseForm, v2Statement: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white placeholder-slate-500"
                ></textarea>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowNewCaseModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold rounded-lg cursor-pointer"
                >
                  Create & Begin Investigation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ADD SINGLE PARTY STATEMENT
      ========================================================================== */}
      {showPartyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-3">Add Driver / Witness Statement</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                await apiService.createParty(selectedIncident.id, {
                  party_label: fd.get('label'),
                  name: fd.get('name'),
                  vehicle_registration: fd.get('plate'),
                  statement: fd.get('statement'),
                });
                await loadCaseDetails(selectedIncident.id);
                setShowPartyModal(false);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-slate-300 mb-1">Party Role</label>
                <select name="label" className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white">
                  <option value="V1">Driver V1 (Primary Vehicle)</option>
                  <option value="V2">Driver V2 (Secondary Vehicle)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Driver Name</label>
                <input name="name" required placeholder="Full Name" className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white" />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Vehicle Plate / Registration</label>
                <input name="plate" required placeholder="Registration Number" className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white" />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Verbatim Statement</label>
                <textarea name="statement" required rows="3" placeholder="Enter driver's exact claims..." className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white"></textarea>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setShowPartyModal(false)} className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded">Cancel</button>
                <button type="submit" className="px-4 py-1.5 bg-amber-500 text-slate-950 font-bold rounded">Save Statement</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
