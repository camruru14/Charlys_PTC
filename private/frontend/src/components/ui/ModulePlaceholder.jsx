import { IconPlus } from "../../lib/icons";

/*
  Panel base reutilizable para los módulos aún no desarrollados a detalle.
  Mantiene la identidad visual (tarjeta redondeada, sombra sutil, azul corporativo)
  y lista las funciones previstas del módulo.
*/

function ModulePlaceholder({ icon: Icon, title, description, features = [], cta }) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          {Icon ? <Icon width={26} height={26} /> : null}
        </span>

        <h2 className="mt-5 text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{description}</p>

        {features.length > 0 ? (
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {features.map((f) => (
              <li
                key={f}
                className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-600"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                {f}
              </li>
            ))}
          </ul>
        ) : null}

        <button className="mt-7 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">
          <IconPlus width={18} height={18} />
          {cta || "Comenzar"}
        </button>
      </div>
    </div>
  );
}

export default ModulePlaceholder;
