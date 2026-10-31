import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  MessageSquareQuote,
  Cpu,
  Layers,
  FileCheck,
  ShieldCheck,
  Info
} from 'lucide-react';
import EvidenceStats from './EvidenceStats';
import VideoEvidence from './VideoEvidence';
import WitnessStatements from './WitnessStatements';
import SensorRecords from './SensorRecords';
import EvidenceRegister from './EvidenceRegister';

const normalizeEvidenceItem = (ev) => {
  let normalizedType = 'Video Evidence';
  const typeStr = (ev.type || '').toLowerCase();
  if (typeStr.includes('witness') || typeStr.includes('deposition')) {
    normalizedType = 'Witness Statement';
  } else if (
    typeStr.includes('sensor') ||
    typeStr.includes('telemetry') ||
    typeStr.includes('crash data') ||
    typeStr.includes('can bus') ||
    typeStr.includes('edr')
  ) {
    normalizedType = 'Sensor Telemetry';
  }

  return {
    id: ev.id,
    title: ev.name || ev.title,
    fileName: ev.fileName || ev.name,
    witnessName: ev.witnessName || (normalizedType === 'Witness Statement' ? ev.name : undefined),
    witnessId: ev.witnessId || (normalizedType === 'Witness Statement' ? ev.id : undefined),
    statementText: ev.statementText || ev.details,
    locationDetails: ev.locationDetails || 'Accident scene intersection',
    recordedAt: ev.ingestTime || ev.dateAdded,
    type: normalizedType,
    format: ev.format || 'Digital Ingest',
    size: ev.size || ev.duration || (normalizedType === 'Witness Statement' ? `${(ev.details || '').length} chars` : '42.5 MB'),
    dateAdded: ev.dateAdded || ev.ingestTime || new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
    status: ev.status || 'Awaiting Analysis',
    origin: ev.origin || (ev.isLocal ? 'Actual Upload' : 'Preloaded Demo Evidence'),
    source: ev.source || ev.type,
    details: ev.details || ev.statementText,
    hashSHA256: ev.hashSHA256,
    headers: ev.headers,
    totalRows: ev.totalRows,
    sampleRows: ev.sampleRows,
    allRows: ev.allRows,
    previewUrl: ev.previewUrl,
    fileObject: ev.fileObject,
  };
};

export default function EvidenceUpload({
  incident,
  evidenceSources = [],
  setEvidenceSources,
  onUploadEvidence,
  onNavigateTab
}) {
  const [activeSubTab, setActiveSubTab] = useState('video'); // 'video' | 'witness' | 'sensor'

  // Normalize initial evidence items
  const [items, setItems] = useState(() => {
    if (Array.isArray(evidenceSources) && evidenceSources.length > 0) {
      return evidenceSources.map(normalizeEvidenceItem);
    }
    return [];
  });

  // Track incident changes to reset items if user switches incident
  const incidentIdRef = useRef(incident?.id);
  useEffect(() => {
    if (incident?.id && incident.id !== incidentIdRef.current) {
      incidentIdRef.current = incident.id;
      if (Array.isArray(evidenceSources)) {
        setItems(evidenceSources.map(normalizeEvidenceItem));
      }
    }
  }, [incident?.id, evidenceSources]);

  // Sync to parent if provided
  useEffect(() => {
    if (typeof setEvidenceSources === 'function') {
      setEvidenceSources(items);
    }
  }, [items, setEvidenceSources]);

  // Sub-category filters
  const videoItems = items.filter((i) => (i.type || '').toLowerCase().includes('video'));
  const witnessItems = items.filter((i) => (i.type || '').toLowerCase().includes('witness'));
  const sensorItems = items.filter((i) => (i.type || '').toLowerCase().includes('sensor') || (i.type || '').toLowerCase().includes('telemetry'));

  // Dynamic Statistics
  const stats = {
    total: items.length,
    videos: videoItems.length,
    witnesses: witnessItems.length,
    sensors: sensorItems.length,
    actualUploads: items.filter((i) => (i.origin || '').toLowerCase().includes('upload') || (i.origin || '').toLowerCase().includes('direct')).length,
    preloadedDemo: items.filter((i) => (i.origin || '').toLowerCase().includes('preload') || (i.origin || '').toLowerCase().includes('demo')).length,
    simulated: items.filter((i) => (i.origin || '').toLowerCase().includes('simulate')).length,
    awaitingAnalysis: items.filter((i) => (i.status || '').toLowerCase().includes('awaiting')).length,
  };

  // Video Handlers
  const handleAddVideos = (newVideos) => {
    setItems((prev) => [...newVideos, ...prev]);
  };

  const handleRemoveVideo = (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Witness Handlers
  const handleAddStatement = (newStmt) => {
    setItems((prev) => [newStmt, ...prev]);
  };

  const handleUpdateStatement = (id, updatedFields) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updatedFields } : item))
    );
  };

  const handleDeleteStatement = (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Sensor Handlers
  const handleAddSensorRecords = (newSensors) => {
    setItems((prev) => {
      const newIds = new Set((newSensors || []).map((s) => s.id));
      const newNames = new Set((newSensors || []).map((s) => (s.fileName || s.title || '').toLowerCase().trim()));
      const filteredPrev = prev.filter(
        (p) => !newIds.has(p.id) && !newNames.has((p.fileName || p.title || '').toLowerCase().trim())
      );
      return [...newSensors, ...filteredPrev];
    });
  };

  const handleRemoveSensorRecord = (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // General Register Handler
  const handleRemoveItem = (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto font-sans">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#D9DEE3]">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-xs font-sans font-medium px-2.5 py-0.5 rounded bg-[#EBF2EE] text-[#527D70] border border-[#D0E0D6]">
              Evidence Upload Center
            </span>
            <span className="font-mono text-xs font-semibold text-[#25364A] bg-[#FAFAF8] px-2 py-0.5 rounded border border-[#D9DEE3]">
              Incident: {incident?.id || 'INC-2026-0884'}
            </span>
          </div>

          <h1 className="text-2xl font-bold text-[#25364A] tracking-tight">
            Evidence Management
          </h1>

          <p className="text-xs text-[#697586] leading-relaxed">
            Collect, organize and review evidence associated with this incident.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <div className="px-3.5 py-2 rounded-md bg-white border border-[#D9DEE3] text-[#25364A] shadow-xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#527D70]"></span>
            <span className="text-[#697586]">Case status:</span>
            <span className="font-medium text-[#527D70]">Active Collection</span>
          </div>
        </div>
      </div>

      {/* 2. Dynamic Evidence Statistics */}
      <EvidenceStats stats={stats} />

      {/* 3. Three-Tab Navigation */}
      <div className="space-y-6">
        <div className="flex border-b border-[#D9DEE3] space-x-2 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('video')}
            className={`flex items-center space-x-2 px-5 py-3 text-xs font-sans font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeSubTab === 'video'
                ? 'border-[#527D70] text-[#527D70] font-semibold bg-white'
                : 'border-transparent text-[#697586] hover:text-[#25364A] hover:border-[#D9DEE3]'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Video Evidence</span>
            <span className="ml-1 text-xs px-2 py-0.2 rounded-full bg-[#EFF4F9] text-[#7189A6] font-mono">
              {stats.videos}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('witness')}
            className={`flex items-center space-x-2 px-5 py-3 text-xs font-sans font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeSubTab === 'witness'
                ? 'border-[#527D70] text-[#527D70] font-semibold bg-white'
                : 'border-transparent text-[#697586] hover:text-[#25364A] hover:border-[#D9DEE3]'
            }`}
          >
            <MessageSquareQuote className="w-4 h-4" />
            <span>Witness Statements</span>
            <span className="ml-1 text-xs px-2 py-0.2 rounded-full bg-[#FAF4EB] text-[#C18A45] font-mono">
              {stats.witnesses}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('sensor')}
            className={`flex items-center space-x-2 px-5 py-3 text-xs font-sans font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeSubTab === 'sensor'
                ? 'border-[#527D70] text-[#527D70] font-semibold bg-white'
                : 'border-transparent text-[#697586] hover:text-[#25364A] hover:border-[#D9DEE3]'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Sensor Records</span>
            <span className="ml-1 text-xs px-2 py-0.2 rounded-full bg-[#EBF2EE] text-[#527D70] font-mono">
              {stats.sensors}
            </span>
          </button>
        </div>

        {/* Tab Content Display */}
        <div>
          {activeSubTab === 'video' && (
            <VideoEvidence
              videos={videoItems}
              onAddVideos={handleAddVideos}
              onRemoveVideo={handleRemoveVideo}
            />
          )}

          {activeSubTab === 'witness' && (
            <WitnessStatements
              statements={witnessItems}
              onAddStatement={handleAddStatement}
              onUpdateStatement={handleUpdateStatement}
              onDeleteStatement={handleDeleteStatement}
              onNavigateTab={onNavigateTab}
            />
          )}

          {activeSubTab === 'sensor' && (
            <SensorRecords
              sensors={sensorItems}
              onAddSensorRecords={handleAddSensorRecords}
              onRemoveSensorRecord={handleRemoveSensorRecord}
            />
          )}
        </div>
      </div>

      {/* 4. Unified Evidence Register (Complete Case Ledger) */}
      <div className="pt-4">
        <EvidenceRegister
          evidenceItems={items}
          onRemoveItem={handleRemoveItem}
        />
      </div>
    </div>
  );
}
