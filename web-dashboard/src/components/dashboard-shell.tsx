"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Resumen", roles: ["ADMIN", "ORG_ADMIN", "SITE_ADMIN", "MEDICO", "PROFESSIONAL", "ODONTOLOGO", "PSICOLOGO", "RECEPCIONISTA"] },
  { href: "/appointments", label: "Agenda", roles: ["ADMIN", "MEDICO", "PROFESSIONAL", "ODONTOLOGO", "PSICOLOGO", "RECEPCIONISTA"] },
  { href: "/patients", label: "Pacientes", roles: ["ADMIN", "MEDICO", "PROFESSIONAL", "ODONTOLOGO", "PSICOLOGO", "RECEPCIONISTA"] },
  { href: "/psychology", label: "Psicología", roles: ["PSICOLOGO", "MEDICO", "PROFESSIONAL", "ADMIN"] },
  { href: "/j48", label: "IA J48", roles: ["PSICOLOGO", "ADMIN", "MEDICO"] },
  { href: "/admin", label: "Administración", roles: ["ADMIN", "ORG_ADMIN", "SITE_ADMIN", "SUPER_ADMIN"] },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, hasRole } = useAuthStore();

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="w-64 shrink-0 border-r border-slate-800 bg-slate-900 p-4">
        <div className="mb-8 font-semibold text-teal-400">COP Clínico</div>
        <nav className="flex flex-col gap-1" aria-label="Panel">
          {nav
            .filter((item) => item.roles.some((r) => hasRole(r)))
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm transition hover:bg-slate-800",
                  pathname === item.href && "bg-teal-900/50 text-teal-200",
                )}
              >
                {item.label}
              </Link>
            ))}
        </nav>
        <button
          type="button"
          className="mt-8 w-full rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
          onClick={() => {
            logout();
            router.push("/login");
          }}
        >
          Salir
        </button>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="border-b border-slate-800 px-6 py-4 text-sm text-slate-400">
          Panel médico enterprise
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
