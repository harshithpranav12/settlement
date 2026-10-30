import {
  INCIDENTS,
  EVIDENCE_SOURCES,
  DETECTED_VEHICLES,
  TIMELINE_EVENTS,
  CONTRADICTIONS,
  TRAJECTORY_DATA,
  PROCESSING_PIPELINE,
  RECENT_ACTIVITY_LOG,
} from '../data/mockData';

/**
 * TRACE AI Frontend API Service
 * Pure Mock Data Mode: Returns verified forensic mock data directly
 * until backend FastAPI service (port 8000) is connected.
 * Guarantees all multi-item entities are returned as valid arrays.
 */

export const apiService = {
  // Incidents
  async getIncidents() {
    return Array.isArray(INCIDENTS) ? [...INCIDENTS] : [];
  },

  async getIncidentById(id) {
    if (!Array.isArray(INCIDENTS)) return null;
    return INCIDENTS.find((inc) => inc.id === id) || INCIDENTS[0] || null;
  },

  // Evidence Sources
  async getEvidenceSources(_incidentId) {
    return Array.isArray(EVIDENCE_SOURCES) ? [...EVIDENCE_SOURCES] : [];
  },

  async uploadEvidence(file, metadata = {}) {
    const newEvidence = {
      id: `EVD-NEW-${Date.now().toString().slice(-4)}`,
      name: file.name || 'Uploaded File',
      type: metadata.type || 'Digital Evidence File',
      format: file.type || 'application/octet-stream',
      duration: '00:01:30',
      hashSHA256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      ingestTime: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      status: 'Awaiting Analysis',
      origin: 'Actual Upload',
      syncDriftMs: 0,
      calibrated: false,
      detections: 0,
      details: 'Locally ingested evidentiary file. Awaiting forensic pipeline processing.',
    };
    return newEvidence;
  },

  // Detected Vehicles
  async getDetectedVehicles(_incidentId) {
    return Array.isArray(DETECTED_VEHICLES) ? [...DETECTED_VEHICLES] : [];
  },

  // Timeline Events
  async getTimelineEvents(_incidentId) {
    return Array.isArray(TIMELINE_EVENTS) ? [...TIMELINE_EVENTS] : [];
  },

  // Contradictions
  async getContradictions(_incidentId) {
    return Array.isArray(CONTRADICTIONS) ? [...CONTRADICTIONS] : [];
  },

  // Trajectory Telemetry
  async getTrajectoryData(_incidentId) {
    return Array.isArray(TRAJECTORY_DATA) ? [...TRAJECTORY_DATA] : [];
  },

  // Processing Pipeline
  async getPipelineStatus(_incidentId) {
    return Array.isArray(PROCESSING_PIPELINE) ? [...PROCESSING_PIPELINE] : [];
  },

  // Activity Audit Log
  async getActivityLogs(_incidentId) {
    return Array.isArray(RECENT_ACTIVITY_LOG) ? [...RECENT_ACTIVITY_LOG] : [];
  },
};

export default apiService;
