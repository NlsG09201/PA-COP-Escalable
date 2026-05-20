"use client";

export default function AdminPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Administración</h1>
      <p className="mt-2 text-sm text-slate-400">
        KPIs, auditoría, asignación de roles y sedes. Conectado a{" "}
        <code className="text-teal-400">/api/admin/users</code> y analytics del API Nest.
      </p>
      <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-slate-300">
        <li>Roles: SUPER_ADMIN, ADMIN, ODONTOLOGO, PSICOLOGO, RECEPCIONISTA</li>
        <li>Reportes PDF/Excel vía módulo de reportes del backend</li>
        <li>Logs de auditoría en colección MongoDB audit_logs</li>
      </ul>
    </div>
  );
}
