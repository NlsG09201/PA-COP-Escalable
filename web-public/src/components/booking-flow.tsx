"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { publicApi } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "./ui/button";

type Site = { id: string; name: string; municipality?: string; department?: string };
type Service = {
  id: string;
  title: string;
  category: string;
  durationMinutes: number;
  priceToPay: number;
};
type Slot = { startAt: string; endAt: string; professionalId: string; professionalName: string };

export function BookingFlow() {
  const router = useRouter();
  const token = useAuthStore((s) => s.accessToken);
  const [department, setDepartment] = useState("");
  const [siteId, setSiteId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const departmentsQ = useQuery({ queryKey: ["departments"], queryFn: publicApi.departments });
  const sitesQ = useQuery({
    queryKey: ["sites", department],
    queryFn: () => publicApi.sites(department || undefined),
  });
  const catalogQ = useQuery({
    queryKey: ["catalog", siteId],
    queryFn: () => publicApi.catalog(siteId),
    enabled: Boolean(siteId),
  });

  const from = useMemo(() => new Date().toISOString(), []);
  const to = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 21);
    return d.toISOString();
  }, []);

  const availabilityQ = useQuery({
    queryKey: ["availability", siteId, serviceId],
    queryFn: () => publicApi.availability(siteId, serviceId, from, to),
    enabled: Boolean(siteId && serviceId),
  });

  const bookingMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => publicApi.createBooking(body, token),
    onSuccess: (data) => {
      const id = String((data as { booking?: { id?: string } }).booking?.id ?? (data as { id?: string }).id ?? "");
      if (id) router.push(`/booking/confirmation/${id}`);
    },
  });

  const sites = (sitesQ.data ?? []) as Site[];
  const services = (catalogQ.data ?? []) as Service[];
  const slots = ((availabilityQ.data as { slots?: Slot[] })?.slots ?? []) as Slot[];

  const submit = () => {
    if (!siteId || !serviceId || !slot) return;
    bookingMut.mutate({
      siteId,
      serviceId,
      slotStartAt: slot.startAt,
      slotEndAt: slot.endAt,
      professionalId: slot.professionalId,
      patient: { fullName, email, phone },
    });
  };

  return (
    <section id="booking" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Agenda online</p>
      <h2 className="mt-1 text-2xl font-bold text-slate-900">Reserva tu cita</h2>
      <p className="mt-1 text-slate-600">Odontología y psicología — selecciona sede, servicio y horario.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Departamento</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setSiteId("");
            }}
          >
            <option value="">Todos</option>
            {(departmentsQ.data ?? []).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="font-medium text-slate-700">Sede</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={siteId}
            onChange={(e) => {
              setSiteId(e.target.value);
              setServiceId("");
            }}
          >
            <option value="">Seleccione sede</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.municipality ? ` · ${s.municipality}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm md:col-span-2">
          <span className="font-medium text-slate-700">Servicio / especialidad</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            disabled={!siteId}
          >
            <option value="">Seleccione servicio</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.category}) — ${s.priceToPay?.toLocaleString("es-CO")}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm md:col-span-2">
          <span className="font-medium text-slate-700">Horario disponible</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={slot ? `${slot.startAt}|${slot.professionalId}` : ""}
            onChange={(e) => {
              const found = slots.find(
                (s) => `${s.startAt}|${s.professionalId}` === e.target.value,
              );
              setSlot(found ?? null);
            }}
            disabled={!serviceId || availabilityQ.isLoading}
          >
            <option value="">Seleccione horario</option>
            {slots.map((s) => (
              <option key={`${s.startAt}-${s.professionalId}`} value={`${s.startAt}|${s.professionalId}`}>
                {new Date(s.startAt).toLocaleString("es-CO")} — {s.professionalName}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="font-medium text-slate-700">Nombre completo</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Correo</span>
          <input
            type="email"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="font-medium text-slate-700">Teléfono</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
      </div>

      {bookingMut.isError && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          No se pudo crear la reserva. Verifica datos e intenta de nuevo.
        </p>
      )}

      <Button className="mt-6" onClick={submit} disabled={bookingMut.isPending || !slot}>
        {bookingMut.isPending ? "Reservando…" : "Confirmar reserva"}
      </Button>
    </section>
  );
}
