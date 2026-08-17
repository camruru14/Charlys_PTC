import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-32 text-center">
      <h1 className="font-display text-4xl font-bold">Página no encontrada</h1>
      <p className="mt-4 text-muted-foreground">
        La página que buscas no existe o fue movida.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
      >
        Volver al inicio
      </Link>
    </section>
  );
}
