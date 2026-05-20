"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { API_BASE } from "@/lib/utils";
import type { MedicalAlert } from "@/lib/medical-ai-api";

export function useMedicalAiSocket(token: string | null) {
  const [alerts, setAlerts] = useState<MedicalAlert[]>([]);

  useEffect(() => {
    if (!token) return;
    const socket: Socket = io(`${API_BASE}/medical-ai`, {
      auth: { token },
      transports: ["websocket"],
    });

    socket.on("medical-alert", (payload: MedicalAlert) => {
      setAlerts((prev) => [payload, ...prev].slice(0, 30));
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  return alerts;
}
