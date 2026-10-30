import React from "react";
import { ActionStatus, ReviewStatus } from "../types/clinical";
import { CheckCircle2, Clock, AlertTriangle, XCircle, RotateCcw, HelpCircle } from "lucide-react";

interface StatusBadgeProps {
  status: ActionStatus;
  size?: "sm" | "md";
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = "md" }) => {
  const configs: Record<ActionStatus, { bg: string; text: string; border: string; label: string; icon: any }> = {
    administered: {
      bg: "bg-emerald-50 dark:bg-emerald-950/60",
      text: "text-emerald-800 dark:text-emerald-400",
      border: "border-emerald-300 dark:border-emerald-500/40",
      label: "Administered",
      icon: CheckCircle2
    },
    planned: {
      bg: "bg-amber-50 dark:bg-amber-950/60",
      text: "text-amber-800 dark:text-amber-400",
      border: "border-amber-300 dark:border-amber-500/40",
      label: "Planned / Prepared",
      icon: Clock
    },
    refused: {
      bg: "bg-rose-50 dark:bg-rose-950/60",
      text: "text-rose-800 dark:text-rose-400",
      border: "border-rose-300 dark:border-rose-500/40",
      label: "Patient Refused",
      icon: XCircle
    },
    withheld: {
      bg: "bg-orange-50 dark:bg-orange-950/60",
      text: "text-orange-800 dark:text-orange-400",
      border: "border-orange-300 dark:border-orange-500/40",
      label: "Withheld / Contraindicated",
      icon: AlertTriangle
    },
    discontinued: {
      bg: "bg-slate-100 dark:bg-slate-800",
      text: "text-slate-700 dark:text-slate-300",
      border: "border-slate-300 dark:border-slate-600",
      label: "Discontinued",
      icon: RotateCcw
    },
    prior_administration: {
      bg: "bg-indigo-50 dark:bg-indigo-950/60",
      text: "text-indigo-800 dark:text-indigo-400",
      border: "border-indigo-300 dark:border-indigo-500/40",
      label: "Prior to Arrival",
      icon: RotateCcw
    },
    mentioned: {
      bg: "bg-zinc-100 dark:bg-zinc-800",
      text: "text-zinc-700 dark:text-zinc-400",
      border: "border-zinc-300 dark:border-zinc-700",
      label: "Mentioned Only",
      icon: HelpCircle
    }
  };

  const cfg = configs[status] || configs.mentioned;
  const Icon = cfg.icon;
  const padding = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs font-medium";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border shadow-xs ${cfg.bg} ${cfg.text} ${cfg.border} ${padding}`}>
      <Icon className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      {cfg.label}
    </span>
  );
};

export const ReviewBadge: React.FC<{ status: ReviewStatus }> = ({ status }) => {
  const map: Record<ReviewStatus, { label: string; color: string; border: string; bg: string }> = {
    pending: { label: "Pending Verification", color: "text-amber-800 dark:text-amber-400", border: "border-amber-300 dark:border-amber-500/30", bg: "bg-amber-50 dark:bg-amber-950/40" },
    confirmed: { label: "Verified & Confirmed", color: "text-emerald-800 dark:text-emerald-400", border: "border-emerald-300 dark:border-emerald-500/30", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
    rejected: { label: "Rejected", color: "text-rose-800 dark:text-rose-400", border: "border-rose-300 dark:border-rose-500/30", bg: "bg-rose-50 dark:bg-rose-950/40" },
    modified: { label: "Modified / Amended", color: "text-sky-800 dark:text-sky-400", border: "border-sky-300 dark:border-sky-500/30", bg: "bg-sky-50 dark:bg-sky-950/40" }
  };
  const cfg = map[status] || map.pending;

  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border shadow-xs ${cfg.bg} ${cfg.border} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
};
