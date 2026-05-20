"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthStore } from "@/lib/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [siteId, setSiteId] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <form
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await login(username, password, siteId || undefined);
            router.push("/dashboard");
          } catch {
            setError("Error de autenticación");
          }
        }}
      >
        <h1 className="text-xl font-bold text-teal-400">Panel clínico COP</h1>
        <label className="mt-4 block text-sm">
          Usuario
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label className="mt-3 block text-sm">
          Contraseña
          <input
            type="password"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <label className="mt-3 block text-sm">
          Site ID (opcional)
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          />
        </label>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          className="mt-6 w-full rounded-lg bg-teal-600 py-2 font-medium hover:bg-teal-500"
        >
          Ingresar
        </button>
      </form>
    </div>
  );
}
