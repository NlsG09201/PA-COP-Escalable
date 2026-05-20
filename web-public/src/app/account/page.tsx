"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

export default function AccountPage() {
  const router = useRouter();
  const { accessToken, user, loadMe, logout } = useAuthStore();

  useEffect(() => {
    if (!accessToken) {
      router.replace("/login");
      return;
    }
    loadMe().catch(() => router.replace("/login"));
  }, [accessToken, loadMe, router]);

  if (!accessToken) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-bold">Mi perfil</h1>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Usuario</dt>
            <dd className="font-medium">{String(user?.username ?? user?.email ?? "—")}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Nombre</dt>
            <dd className="font-medium">{String(user?.fullName ?? "—")}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Roles</dt>
            <dd className="font-medium">{Array.isArray(user?.roles) ? (user.roles as string[]).join(", ") : "PACIENTE"}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => {
            logout();
            router.push("/");
          }}
          className="mt-6 rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Cerrar sesión
        </button>
      </div>
      <p className="mt-6 text-sm text-slate-600">
        Historial de citas, pagos y documentos clínicos están disponibles desde el panel médico tras tu
        atención.
      </p>
    </div>
  );
}
