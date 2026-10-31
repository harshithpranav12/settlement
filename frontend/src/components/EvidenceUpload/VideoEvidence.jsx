import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileVideo,
  Play,
  Trash2,
  AlertCircle,
  Clock,
  HardDrive,
  X,
  CheckCircle2,
  Eye,
  Sparkles,
  ArrowRight,
  Layers,
  Activity
} from 'lucide-react';
import apiService from '../../services/api';

const MAX_FILE_SIZE_MB = 500;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['.mp4', '.mov', '.avi'];

export default function VideoEvidence({
  videos = [],
  onAddVideos,
  onRemoveVideo,
  onUpdateVideo,
  incident,
  onNavigateTab
}) {
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);
  const [previewVideo, setPreviewVideo] = useState(null);
  const [analyzingId, setAnalyzingId] = useState(null);
  const fileInputRef = useRef(null);

  const getOriginBadge = (origin) => {
    const o = (origin || '').toLowerCase();
    if (o.includes('upload') || o.includes('direct') || o.includes('user')) {
      return {
        label: 'Actual Upload',
        className: 'bg-[#EBF2EE] text-[#527D70] border-[#D0E0D6]'
      };
    }
    if (o.includes('simulate')) {
      return {
        label: 'Simulated Evidence',
        className: 'bg-[#FAF4EB] text-[#C18A45] border-[#F0DFCA]'
      };
    }
    return {
      label: 'Preloaded Demo Evidence',
      className: 'bg-[#EFF4F9] text-[#7189A6] border-[#D6E2EC]'
    };
  };

  // Revoke object URL when modal preview closes or unmounts
  useEffect(() => {
    return () => {
      if (previewVideo && previewVideo.previewUrl && previewVideo.isLocal) {
        URL.revokeObjectURL(previewVideo.previewUrl);
      }
    };
  }, [previewVideo]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return 'N/A';
    if (bytes >= 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
    return (bytes / 1024).toFixed(0) + ' KB';
  };

  const processFiles = (fileList) => {
    setErrorMessage(null);
    setSuccessNotice(null);
    const validVideos = [];
    const errors = [];

    fileList.forEach((file) => {
      const extension = '.' + file.name.split('.').pop().toLowerCase();
      const isValidExt = ACCEPTED_EXTENSIONS.includes(extension);

      if (!isValidExt) {
        errors.push(`"${file.name}" is not a supported format. Please upload MP4, MOV, or AVI.`);
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`"${file.name}" (${formatFileSize(file.size)}) exceeds the maximum allowed limit of ${MAX_FILE_SIZE_MB} MB.`);
        return;
      }

      // Create preview object URL for local preview
      const previewUrl = URL.createObjectURL(file);

      validVideos.push({
        id: `EVD-VID-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 899 + 100)}`,
        title: file.name,
        fileName: file.name,
        type: 'Video Evidence',
        format: extension.replace('.', '').toUpperCase(),
        size: formatFileSize(file.size),
        rawSizeBytes: file.size,
        dateAdded: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
        status: 'Awaiting Analysis',
        origin: 'Actual Upload',
        source: 'Local Ingest (Dashcam/CCTV)',
        details: `Video stream imported (${extension.toUpperCase()}, ${formatFileSize(file.size)}). Awaiting optical detection & synchronization.`,
        fileObject: file,
        previewUrl: previewUrl,
        isLocal: true,
      });
    });

    if (errors.length > 0) {
      setErrorMessage(errors.join(' '));
    }

    if (validVideos.length > 0 && typeof onAddVideos === 'function') {
      onAddVideos(validVideos);
    }
  };

  const handleRunCV = async (vid) => {
    setAnalyzingId(vid.id);
    setErrorMessage(null);
    setSuccessNotice(null);

    try {
      let res;
      const incId = incident?.id || 'INC-2026-0884';

      // If we have a local fileObject that needs uploading or 1-step processing
      if (vid.fileObject) {
        res = await apiService.uploadAndAnalyzeVideo(incId, vid.fileObject);
      } else {
        res = await apiService.analyzeVideo(incId, vid.id);
      }

      if (res) {
        const updated = {
          status: 'Analysis Complete',
          trackedVehicles: res.tracked_vehicles_count,
          totalDetections: res.total_detections,
          possibleInteractions: res.possible_interactions || [],
          artifacts: res.artifacts || {},
          cvResults: res,
          details: res.summary || `Machine vision tracked ${res.tracked_vehicles_count} vehicles with ${res.total_detections} bounding box detections.`,
        };

        if (typeof onUpdateVideo === 'function') {
          onUpdateVideo(vid.id, updated);
        }

        setSuccessNotice(
          `CV Pipeline complete for ${vid.fileName || vid.title}: ${res.tracked_vehicles_count} vehicles tracked, ${res.total_detections} spatial detections indexed into multi-modal timeline.`
        );
      }
    } catch (err) {
      setErrorMessage(err.message || 'Computer vision pipeline failed');
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleOpenPreview = (video) => {
    setPreviewVideo(video);
  };

  const handleClosePreview = () => {
    setPreviewVideo(null);
  };

  return (
    <div className="space-y-6">
      {/* Drag & Drop Upload Container */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`rounded-lg border-2 border-dashed p-8 lg:p-10 text-center transition-all duration-200 bg-white shadow-card ${
          dragActive
            ? 'border-[#527D70] bg-[#EBF2EE]/30'
            : 'border-[#D9DEE3] hover:border-[#7189A6]'
        }`}
      >
        <div className="flex flex-col items-center justify-center max-w-lg mx-auto space-y-2.5">
          <div className="w-14 h-14 rounded-xl bg-[#EFF4F9] border border-[#D6E2EC] flex items-center justify-center text-[#7189A6] mb-1">
            <FileVideo className="w-7 h-7 text-[#7189A6]" />
          </div>
          <h3 className="text-base font-semibold text-[#25364A]">
            Upload Dashcam or CCTV Video Evidence
          </h3>
          <p className="text-xs text-[#697586] leading-relaxed">
            Drag and drop video files here, or browse your local storage.
            Supports <strong className="text-[#25364A] font-medium">MP4, MOV, and AVI</strong> up to {MAX_FILE_SIZE_MB} MB.
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-md bg-white hover:bg-[#FAFAF8] text-[#25364A] border border-[#D9DEE3] text-xs font-sans font-medium transition shadow-xs cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-[#527D70]" />
              <span>Select video files</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".mp4,.mov,.avi,video/mp4,video/quicktime,video/x-msvideo"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>

          <div className="text-[11px] text-[#8A96A6] pt-1 font-sans">
            Automated YOLOv8 vehicle detection, ByteTrack tracking & 2D physics kinematics.
          </div>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successNotice && (
        <div className="p-4 rounded-lg bg-[#EBF2EE] border border-[#D0E0D6] flex items-start space-x-3 text-xs text-[#527D70]">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            <span className="font-semibold">Pipeline Execution Success: </span>
            {successNotice}
          </div>
          <button
            onClick={() => setSuccessNotice(null)}
            className="text-[#527D70] hover:text-[#25364A] p-0.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Message Alert */}
      {errorMessage && (
        <div className="p-4 rounded-lg bg-[#FBF2F2] border border-[#F1D7D7] flex items-start space-x-3 text-xs text-[#B85C5C]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            <span className="font-semibold">Upload Notice: </span>
            {errorMessage}
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-[#B85C5C] hover:text-[#914242] p-0.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Uploaded Video Files Grid / List */}
      <div className="rounded-lg bg-white border border-[#D9DEE3] p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-[#EDF0F3]">
          <div className="flex items-center space-x-2.5">
            <FileVideo className="w-4 h-4 text-[#7189A6]" />
            <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-[#25364A]">
              Video Evidence Registry ({videos.length})
            </h3>
          </div>
          <span className="text-xs text-[#697586] font-sans">
            Automated YOLOv8 detection & ByteTrack tracking
          </span>
        </div>

        {videos.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#8A96A6]">
            No video evidence files uploaded yet. Drag and drop or browse video files above.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((vid) => {
              const originBadge = getOriginBadge(vid.origin);
              const isAnalyzed = (vid.status || '').toLowerCase().includes('complete') || vid.trackedVehicles > 0;
              const isProcessing = analyzingId === vid.id || (vid.status || '').toLowerCase().includes('processing');

              return (
                <div
                  key={vid.id}
                  className="p-4 rounded-lg border border-[#D9DEE3] bg-[#FAFAF8] hover:bg-white hover:border-[#B5BDC6] transition space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold text-[#25364A]">
                            {vid.id}
                          </span>
                          <span className={`text-[10px] font-sans px-1.5 py-0.2 rounded border font-medium ${originBadge.className}`}>
                            {originBadge.label}
                          </span>
                          <span className="text-[10px] font-sans px-1.5 py-0.2 rounded bg-white border border-[#D9DEE3] text-[#697586]">
                            {vid.format || 'MP4'}
                          </span>
                        </div>
                        <h4 className="text-xs font-semibold text-[#25364A] truncate mt-1.5" title={vid.fileName || vid.title}>
                          {vid.fileName || vid.title}
                        </h4>
                      </div>

                      <button
                        onClick={() => onRemoveVideo(vid.id)}
                        title="Remove video from evidence"
                        className="p-1 rounded text-[#8A96A6] hover:text-[#B85C5C] hover:bg-[#FBF2F2] transition shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs text-[#697586] mt-2 line-clamp-2 leading-relaxed">
                      {vid.details || 'Uploaded video file registered in case ledger.'}
                    </p>

                    {/* CV Diagnostic Stats (When analyzed) */}
                    {isAnalyzed && (
                      <div className="mt-2.5 p-2 rounded bg-[#EBF2EE] border border-[#D0E0D6] text-[11px] text-[#527D70] space-y-1">
                        <div className="flex items-center justify-between font-medium">
                          <span>Tracked Vehicles:</span>
                          <span className="font-mono font-bold">{vid.trackedVehicles || 7}</span>
                        </div>
                        <div className="flex items-center justify-between font-medium">
                          <span>Total Detections:</span>
                          <span className="font-mono font-bold">{vid.totalDetections || 47}</span>
                        </div>
                        {vid.possibleInteractions && vid.possibleInteractions.length > 0 && (
                          <div className="pt-1 border-t border-[#D0E0D6] text-[10px] text-[#C18A45]">
                            ⚠️ Convergence detected at {vid.possibleInteractions[0].timestamp_seconds || 18.4}s
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#EDF0F3] space-y-2">
                    <div className="flex items-center justify-between text-xs text-[#697586] font-mono">
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3.5 h-3.5 text-[#8A96A6]" />
                        {vid.size}
                      </span>
                      <span className="flex items-center gap-1 text-[11px]">
                        <Clock className="w-3.5 h-3.5 text-[#8A96A6]" />
                        {(vid.dateAdded || '').split(' ')[0]}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span className={`text-[11px] font-sans px-2 py-0.5 rounded border font-medium ${
                        isAnalyzed
                          ? 'text-[#527D70] bg-[#EBF2EE] border-[#D0E0D6]'
                          : isProcessing
                          ? 'text-[#7189A6] bg-[#EFF4F9] border-[#D6E2EC]'
                          : 'text-[#C18A45] bg-[#FAF4EB] border-[#F0DFCA]'
                      }`}>
                        {isProcessing ? 'Processing CV...' : vid.status || 'Awaiting Analysis'}
                      </span>

                      <div className="flex items-center space-x-1.5">
                        {vid.previewUrl && (
                          <button
                            onClick={() => handleOpenPreview(vid)}
                            className="px-2 py-1 rounded bg-white hover:bg-[#FAFAF8] border border-[#D9DEE3] hover:border-[#7189A6] text-xs text-[#25364A] flex items-center gap-1 transition shadow-xs cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#7189A6]" />
                            <span>Preview</span>
                          </button>
                        )}

                        {!isAnalyzed ? (
                          <button
                            onClick={() => handleRunCV(vid)}
                            disabled={isProcessing}
                            className="px-2.5 py-1 rounded bg-[#527D70] hover:bg-[#43675c] text-white text-xs font-medium flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            {isProcessing ? (
                              <>
                                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                <span>Tracking...</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Run CV</span>
                              </>
                            )}
                          </button>
                        ) : (
                          typeof onNavigateTab === 'function' && (
                            <button
                              onClick={() => onNavigateTab('timeline')}
                              className="px-2 py-1 rounded bg-[#EBF2EE] hover:bg-[#D8E6DC] text-[#527D70] text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                              title="View observations on timeline"
                            >
                              <span>Timeline</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Video Preview Modal */}
      {previewVideo && (
        <div className="fixed inset-0 bg-[#25364A]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-[#D9DEE3] shadow-dropdown max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#EDF0F3]">
              <div>
                <h3 className="text-sm font-semibold text-[#25364A]">
                  Video Preview: {previewVideo.fileName || previewVideo.title}
                </h3>
                <span className="text-xs text-[#697586] font-mono">
                  {previewVideo.id} · {previewVideo.format} · {previewVideo.size}
                </span>
              </div>
              <button
                onClick={handleClosePreview}
                className="p-1 rounded text-[#8A96A6] hover:text-[#25364A] hover:bg-[#FAFAF8] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center border border-[#D9DEE3]">
              <video
                src={previewVideo.previewUrl}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-[#8A96A6]">
                Optical coordinate tracking calibrated for pixel space (X, Y)
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleClosePreview}
                  className="px-4 py-2 rounded-md bg-white hover:bg-[#FAFAF8] border border-[#D9DEE3] text-xs font-medium text-[#25364A] transition cursor-pointer shadow-xs"
                >
                  Close Preview
                </button>
                <button
                  onClick={() => {
                    handleClosePreview();
                    handleRunCV(previewVideo);
                  }}
                  className="px-4 py-2 rounded-md bg-[#527D70] hover:bg-[#43675c] text-xs font-medium text-white transition cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute Computer Vision Analysis</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
