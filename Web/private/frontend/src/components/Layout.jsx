import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { getPageMeta } from "../lib/nav";

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { title, subtitle } = getPageMeta(location.pathname);

  const handleNewBatch = () => {
    setSidebarOpen(false);
    navigate("/fabricacion?new=1");
  };

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewBatch={handleNewBatch}
      />

      {/* Contenido: se desplaza a la derecha del sidebar en escritorio */}
      <div className="lg:pl-72">
        <TopBar
          title={title}
          subtitle={subtitle}
          onOpenMenu={() => setSidebarOpen(true)}
        />
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
