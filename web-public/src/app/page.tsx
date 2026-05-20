import { BookingFlow } from "@/components/booking-flow";

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <p className="text-sm font-medium uppercase tracking-widest text-teal-200">Salud integral</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
            Cuidado odontológico y psicológico con estándares enterprise
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-teal-100">
            Agenda en línea, historial clínico seguro, pagos integrados y alertas tempranas con inteligencia
            artificial J48.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#booking"
              className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-teal-900 hover:bg-teal-50"
            >
              Agendar cita
            </a>
            <a
              href="#servicios"
              className="rounded-lg border border-white/40 px-5 py-3 text-sm font-semibold hover:bg-white/10"
            >
              Ver especialidades
            </a>
          </div>
        </div>
      </section>

      <section id="servicios" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16">
        <h2 className="text-2xl font-bold text-slate-900">Especialidades</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-teal-800">Odontología</h3>
            <p className="mt-2 text-slate-600">
              Odontograma digital, planes de tratamiento, radiografías e imagen 3D para diagnóstico preciso.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-teal-800">Psicología</h3>
            <p className="mt-2 text-slate-600">
              Sesiones terapéuticas, escalas validadas (GAD-7, PHQ-9), seguimiento emocional y predicción de
              recaída con J48.
            </p>
          </article>
        </div>
      </section>

      <section id="nosotros" className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold text-slate-900">Por qué Centro COP</h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              "Cumplimiento HIPAA-like y auditoría de accesos",
              "Recordatorios por correo, SMS y notificaciones en tiempo real",
              "Pagos Wompi, Stripe y PayPal",
            ].map((item) => (
              <li key={item} className="rounded-xl bg-slate-50 p-4 text-slate-700">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 pb-20">
        <BookingFlow />
      </div>
    </>
  );
}
