"use client";

import Link from "next/link";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "./ui/button";

export function SiteHeader() {
  const { accessToken, logout } = useAuthStore();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-teal-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-700 text-sm text-white">
            COP
          </span>
          Centro Odontológico y Psicológico
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex" aria-label="Principal">
          <a href="#servicios" className="hover:text-teal-800">
            Servicios
          </a>
          <a href="#booking" className="hover:text-teal-800">
            Agendar cita
          </a>
          <a href="#nosotros" className="hover:text-teal-800">
            Nosotros
          </a>
        </nav>
        <div className="flex items-center gap-2">
          {accessToken ? (
            <>
              <Link href="/account">
                <Button variant="outline" size="sm">
                  Mi cuenta
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={logout}>
                Salir
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Ingresar
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Registrarse</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
