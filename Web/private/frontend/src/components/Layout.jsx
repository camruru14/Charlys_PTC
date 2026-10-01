import { useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import { Rail, Drawer } from "./Rail";
import { SelectionMemoryProvider } from "../context/SelectionMemoryContext";

/*
  Estructura del panel: menú lateral de 200px a la izquierda (>= 1024px) o cajón
  deslizable (< 1024px) y el contenido de cada página. Cada página pinta su
  propio <PageHeader />; el botón de menú del header abre el cajón a través
  del contexto del <Outlet>.
*/
function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const outletContext = useMemo(() => ({ openMenu: () => setMenuOpen(true) }), []);

  return (
    <div className="min-h-screen bg-canvas">
      <Rail />
      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="lg:pl-[200px]">
        <main className="flex flex-col gap-3.5 px-4 py-6 sm:px-7">
          {/* Aquí vive (y no en cada página) para que sobreviva a los cambios de pestaña. */}
          <SelectionMemoryProvider>
            <Outlet context={outletContext} />
          </SelectionMemoryProvider>
        </main>
      </div>
    </div>
  );
}

export default Layout;
