import React from "react";
import { useAppState } from "@/contexts/AppStateContext";
import { X, AlertTriangle, Info, Siren } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const AlertPanel: React.FC = () => {
  const { alerts, dismissAlert } = useAppState();

  const iconMap = {
    geofence: <Siren className="w-4 h-4 text-primary" />,
    priority: <AlertTriangle className="w-4 h-4 text-warning" />,
    info: <Info className="w-4 h-4 text-info" />,
  };

  const borderMap = {
    geofence: "border-primary/30 bg-primary/5",
    priority: "border-warning/30 bg-warning/5",
    info: "border-info/30 bg-info/5",
  };

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      <AnimatePresence>
        {alerts.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No alerts</p>
        )}
        {alerts.slice(0, 10).map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className={`flex items-start gap-2 p-2.5 rounded-lg border ${borderMap[alert.type]}`}
          >
            <div className="mt-0.5">{iconMap[alert.type]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground leading-snug">{alert.message}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {alert.timestamp.toLocaleTimeString()}
              </p>
            </div>
            <button onClick={() => dismissAlert(alert.id)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default AlertPanel;
