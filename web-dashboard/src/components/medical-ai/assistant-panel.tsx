"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { medicalAiApi } from "@/lib/medical-ai-api";

export function AssistantPanel({ token, patientId }: { token: string; patientId: string }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);

  const chatM = useMutation({
    mutationFn: (message: string) => medicalAiApi.assistantChat(token, patientId, message),
    onSuccess: (res, message) => {
      setMessages((m) => [
        ...m,
        { role: "user", text: message },
        { role: "assistant", text: res.reply },
      ]);
      setInput("");
    },
  });

  const summaryM = useMutation({
    mutationFn: () => medicalAiApi.assistantSummary(token, patientId),
    onSuccess: (res) => {
      setMessages((m) => [...m, { role: "assistant", text: res.reply }]);
    },
  });

  return (
    <div className="flex h-[420px] flex-col rounded-xl border border-slate-800 bg-slate-900/90">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-cyan-300">Asistente médico IA</h2>
        <button
          type="button"
          onClick={() => summaryM.mutate()}
          disabled={summaryM.isPending}
          className="cursor-pointer rounded-lg bg-cyan-900/50 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-800/50"
        >
          Resumen automático
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-lg px-3 py-2 ${m.role === "user" ? "ml-8 bg-slate-800 text-slate-200" : "mr-8 bg-cyan-950/50 text-slate-100"}`}
          >
            <pre className="whitespace-pre-wrap font-sans text-sm">{m.text}</pre>
          </div>
        ))}
        {chatM.isPending && <p className="text-xs text-slate-500">Analizando contexto clínico…</p>}
      </div>
      <form
        className="flex gap-2 border-t border-slate-800 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) chatM.mutate(input.trim());
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pregunta clínica, evolución, tratamiento…"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-600"
        />
        <button
          type="submit"
          disabled={chatM.isPending}
          className="cursor-pointer rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
