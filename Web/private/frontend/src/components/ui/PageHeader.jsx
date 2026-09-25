import { useOutletContext } from "react-router-dom";
import { IconMenu } from "../../lib/icons";

/*
  Encabezado de página (reemplaza al antiguo TopBar). Título y subtítulo a la
  izquierda; acciones a la derecha, alineadas abajo. En pantallas < 1024px
  muestra el botón que abre el cajón de navegación (lo provee Layout vía
  <Outlet context>).
*/
function PageHeader({ title, subtitle, actions }) {
  const layout = useOutletContext();

  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 items-center gap-3">
        {layout?.openMenu ? (
          <button
            type="button"
            onClick={layout.openMenu}
            aria-label="Abrir menú"
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface text-ink-2 lg:hidden"
          >
            <IconMenu width={19} height={19} />
          </button>
        ) : null}
        <div className="min-w-0">
          <h1 className="t-page-title">{title}</h1>
          {subtitle ? <p className="t-page-sub mt-1">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export default PageHeader;
