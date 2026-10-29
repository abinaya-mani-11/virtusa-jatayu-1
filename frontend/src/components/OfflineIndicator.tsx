import React, { useState, useEffect } from "react";
import { Wifi, WifiOff, Database } from "lucide-react";
import { checkServerHealth } from "../services/api";
import { getPendingQueueCount } from "../services/offlineStorage";

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [backendAlive, setBackendAlive] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const checkStatus = async () => {
      const alive = await checkServerHealth();
      setBackendAlive(alive);
      const queue = await getPendingQueueCount();
      setPendingCount(queue);
    };

    checkStatus();
    const interval = setInterval(checkStatus, 8000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  const isFullyLocal = !isOnline || !backendAlive;

  return (
    <div className="flex items-center gap-2">
      {isFullyLocal ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 border border-amber-500/50 text-amber-300">
          <WifiOff className="w-3.5 h-3.5 animate-pulse" />
          <span>Offline Edge Mode</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/60 border border-emerald-500/40 text-emerald-300">
          <Wifi className="w-3.5 h-3.5" />
          <span>Local Backend Ready</span>
        </div>
      )}

      {pendingCount > 0 && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-sky-950/70 border border-sky-500/40 text-sky-300">
          <Database className="w-3 h-3" />
          <span>{pendingCount} Queued</span>
        </div>
      )}
    </div>
  );
};
