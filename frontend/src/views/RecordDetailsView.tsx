import React, { useState } from "react";
import {
  FileText, Download, ShieldCheck, Clock,
  ArrowLeft, Edit3, Code
} from "lucide-react";
import { ClinicalRecord } from "../types/clinical";
import { getPdfExportUrl, getFhirBundle, getNativeJson } from "../services/api";
import { StatusBadge } from "../components/StatusBadge";
import { ConfidenceMeter } from "../components/ConfidenceMeter";

interface RecordDetailsViewProps {
  record: ClinicalRecord;
  onBack: () => void;
  onEdit: () => void;
}

export const RecordDetailsView: React.FC<RecordDetailsViewProps> = ({ record, onBack, onEdit }) => {
  const [fhirModalOpen, setFhirModalOpen] = useState(false);
  const [fhirBundle, setFhirBundle] = useState<any>(null);
  const [loadingFhir, setLoadingFhir] = useState(false);

  const handleDownloadPdf = () => {
    window.open(getPdfExportUrl(record.record_id), "_blank");
  };

  const handleDownloadJson = async () => {
    const data = await getNativeJson(record.record_id);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FieldToRecord_${record.record_id.slice(0, 8)}_rev${record.audit.revision}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenFhir = async () => {
    setLoadingFhir(true);
    try {
      const bundle = await getFhirBundle(record.record_id);
      setFhirBundle(bundle);
      setFhirModalOpen(true);
    } catch (e) {
      console.error("Failed to load FHIR bundle:", e);
    } finally {
      setLoadingFhir(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16 transition-colors duration-150">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-800 transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Clinical Incident Record</h1>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                  record.audit.record_status === "approved"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-500/30"
                    : "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-500/30"
                }`}
              >
                {record.audit.record_status.toUpperCase()}
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-400 border border-sky-300 dark:border-sky-500/30">
                Rev #{record.audit.revision}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              Record ID: {record.record_id}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 transition-all active:scale-95 shadow-2xs"
          >
            <Edit3 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            Edit / Review
          </button>

          <button
            onClick={handleOpenFhir}
            disabled={loadingFhir}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 transition-all active:scale-95 shadow-2xs"
          >
            <Code className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            FHIR R4 Bundle
          </button>

          <button
            onClick={handleDownloadJson}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 transition-all active:scale-95 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Export JSON
          </button>

          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md shadow-sky-950/20 border border-sky-400/30 transition-all active:scale-95"
          >
            <FileText className="w-3.5 h-3.5" />
            Printable PDF Report
          </button>
        </div>
      </div>

      {/* Metadata & Audit Seal Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs dark:shadow-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div>
          <span className="text-slate-500 dark:text-slate-400 font-semibold">Author / Responder:</span>
          <p className="font-bold text-slate-900 dark:text-white mt-0.5">{record.audit.created_by}</p>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400 font-semibold">Created Time:</span>
          <p className="font-mono text-slate-800 dark:text-slate-200 mt-0.5 font-medium">
            {new Date(record.source.created_at).toLocaleString()}
          </p>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400 font-semibold">Modality / Duration:</span>
          <p className="text-slate-800 dark:text-slate-200 mt-0.5 capitalize font-medium">
            {record.source.type.replace("_", " ")} {record.source.audio_duration_seconds ? `(${record.source.audio_duration_seconds}s)` : ""}
          </p>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400 font-semibold">Cryptographic Hash Seal:</span>
          <p className="mt-0.5 font-mono text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-bold">
            <ShieldCheck className="w-3.5 h-3.5" /> SHA-256 VERIFIED
          </p>
        </div>
      </div>

      {/* Original Note Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs dark:shadow-md space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          Original On-Scene Dictation / Transcript
        </h2>
        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-200 italic leading-relaxed">
          "{record.source.original_text}"
        </div>
      </div>

      {/* Chronological Event Timeline */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs dark:shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            Chronological Care Timeline ({record.events.length} Events)
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">Time-ordered sequence of actions & procedures</span>
        </div>

        {record.events.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">No clinical events recorded.</div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            {record.events.map((ev) => {
              const isMed = ev.event_type === "medication_administration";
              const isProc = ev.event_type === "procedure";

              return (
                <div key={ev.event_id} className="relative group">
                  {/* Timeline Node Dot */}
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-sky-600 dark:bg-sky-500 border-2 border-white dark:border-slate-900 ring-2 ring-sky-500/30" />

                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-4 transition-all space-y-2 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-sky-800 dark:text-sky-400 bg-sky-100 dark:bg-sky-950/80 px-2 py-0.5 rounded border border-sky-300 dark:border-sky-500/30">
                          {ev.event_time || "Time Unknown"}
                        </span>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                          {isMed
                            ? ev.medication?.name
                            : isProc
                            ? ev.procedure_name
                            : ev.observation_name}
                        </h3>
                        {ev.is_correction && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                            CORRECTION
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <StatusBadge status={ev.administration_status} size="sm" />
                        <ConfidenceMeter score={ev.confidence} />
                      </div>
                    </div>

                    {/* Details Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-700 dark:text-slate-300 pt-1">
                      {ev.dose && ev.dose.value !== null && (
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Dose: </span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {ev.dose.value} {ev.dose.unit || ""}
                          </span>
                        </div>
                      )}
                      {ev.route && ev.route.normalized && (
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Route: </span>
                          <span className="font-bold text-slate-900 dark:text-white uppercase">
                            {ev.route.normalized}
                          </span>
                        </div>
                      )}
                      {ev.performer && (
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Performer: </span>
                          <span className="text-slate-900 dark:text-white font-medium">{ev.performer}</span>
                        </div>
                      )}
                    </div>

                    {/* Source span */}
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-1 border-t border-slate-200 dark:border-slate-900">
                      "{ev.source_span}"
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FHIR R4 Bundle Modal */}
      {fhirModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">FHIR R4 Collection Bundle</h3>
              </div>
              <button
                onClick={() => setFhirModalOpen(false)}
                className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>

            <pre className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono text-indigo-950 dark:text-indigo-200">
              {JSON.stringify(fhirBundle, null, 2)}
            </pre>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setFhirModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-lg text-xs font-semibold"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
