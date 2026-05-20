"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const [siteId, setSiteId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await register({ siteId, email, password, fullName, phone });
      router.push("/account");
    } catch {
      setError("No se pudo completar el registro. Verifica el ID de sede.");
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold">Crear cuenta de paciente</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block text-sm">
          ID de sede (UUID)
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Nombre
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Correo
          <input
            type="email"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Teléfono
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Contraseña
          <input
            type="password"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full">
          Registrarse
        </Button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-teal-700 underline">
          Ingresar
        </Link>
      </p>
    </div>
  );
}
