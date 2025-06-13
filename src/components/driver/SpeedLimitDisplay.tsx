
"use client";

import { Gauge, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpeedLimitDisplayProps {
  currentSpeed: number;
  speedLimit: number;
  isEnabled: boolean;
}

export function SpeedLimitDisplay({ currentSpeed, speedLimit, isEnabled }: SpeedLimitDisplayProps) {
  const isOverLimit = currentSpeed > speedLimit;
  const speedDiff = Math.abs(currentSpeed - speedLimit);

  let statusText = "WITHIN LIMIT";
  let statusColor = "text-green-400";
  let StatusIcon = CheckCircle;

  if (isOverLimit) {
    statusText = "OVER LIMIT";
    statusColor = "text-red-400";
    StatusIcon = AlertTriangle;
  } else if (speedLimit - currentSpeed <= 5 && speedLimit - currentSpeed > 0) { // Approaching limit
    statusText = "APPROACHING LIMIT";
    statusColor = "text-yellow-400";
    StatusIcon = AlertTriangle;
  }


  return (
    <div
      className={cn(
        "absolute bottom-4 left-4 z-50 p-2 md:p-3 rounded-lg shadow-xl bg-black/75 text-white flex items-center space-x-2 md:space-x-3 backdrop-blur-sm transition-all duration-300 ease-in-out",
        "border-2",
        isOverLimit ? "border-red-500/80" : (statusText === "APPROACHING LIMIT" ? "border-yellow-500/80" : "border-green-500/80"),
        !isEnabled && "opacity-0 pointer-events-none scale-90" // Ensure visibility is tied to isEnabled
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex flex-col items-center justify-center">
        <span className="text-xs font-medium text-gray-300 tracking-wide">SPEED</span>
        <Gauge className={cn("w-8 h-8 md:w-10 md:h-10", isOverLimit ? "text-red-400" : "text-blue-400")} />
      </div>
      <div className="text-center">
        <div className={cn("text-3xl md:text-4xl font-bold tracking-tight", isOverLimit ? "text-red-400" : "text-white")}>
          {currentSpeed}
          <span className="text-sm md:text-base font-medium ml-1">mph</span>
        </div>
        <div className={cn("text-xs md:text-sm font-medium flex items-center justify-center gap-1", statusColor)}>
          <StatusIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
          {statusText}
        </div>
      </div>
      <div className="relative flex items-center justify-center w-12 h-12 md:w-16 md:h-16 bg-white rounded-full border-4 border-red-600 text-red-700 shrink-0">
        <span className="text-xl md:text-2xl font-bold text-black">{speedLimit}</span>
      </div>
    </div>
  );
}
