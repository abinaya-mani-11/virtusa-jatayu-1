import React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface ConfidenceMeterProps {
  score: number; // 0.0 to 1.0
  showLabel?: boolean;
}

export const ConfidenceMeter: React.FC<ConfidenceMeterProps> = ({ score, showLabel = true }) => {
  const pct = Math.round(score * 100);
  
  let colorClass = "bg-emerald-500";
  let textClass = "text-emerald-400";
  let level = "High Confidence";

  if (score < 0.70) {
    colorClass = "bg-rose-500";
    textClass = "text-rose-400";
    level = "Low (Review Required)";
  } else if (score < 0.85) {
    colorClass = "bg-amber-500";
    textClass = "text-amber-400";
    level = "Moderate Confidence";
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
        <div
          className={`h-full transition-all duration-300 ${colorClass}`}
          style={{ width: `${Math.min(100, Math.max(10, pct))}%` }}
        />
      </div>
      {showLabel && (
        <span className={`text-xs font-mono font-medium flex items-center gap-1 ${textClass}`}>
          {score < 0.70 ? <AlertCircle className="w-3 h-3 text-rose-400" /> : <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
          {pct}%
        </span>
      )}
    </div>
  );
};
