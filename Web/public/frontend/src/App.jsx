import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import PrivateRoute from "./components/PrivateRoute";

import InicioPage from "./pages/InicioPage";
import ProductosPage from "./pages/ProductosPage";
import ProductoDetallePage from "./pages/ProductoDetallePage";
import CarritoPage from "./pages/CarritoPage";
import CheckoutPage from "./pages/CheckoutPage";
import PedidoConfirmacionPage from "./pages/PedidoConfirmacionPage";
import LoginPage from "./pages/LoginPage";
import RegistroPage from "./pages/RegistroPage";
import RecuperarPasswordPage from "./pages/RecuperarPasswordPage";
import MisPedidosPage from "./pages/MisPedidosPage";
import PerfilPage from "./pages/PerfilPage";
import BeneficiosPage from "./pages/BeneficiosPage";
import ContactoPage from "./pages/ContactoPage";
import NotFoundPage from "./pages/NotFoundPage";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<InicioPage />} />
        <Route path="/productos" element={<ProductosPage />} />
        <Route path="/productos/:slug" element={<ProductoDetallePage />} />
        <Route path="/carrito" element={<CarritoPage />} />
        <Route path="/beneficios" element={<BeneficiosPage />} />
        <Route path="/contacto" element={<ContactoPage />} />
        <Route path="/cuenta/login" element={<LoginPage />} />
        <Route path="/cuenta/registro" element={<RegistroPage />} />
        <Route path="/cuenta/recuperar" element={<RecuperarPasswordPage />} />
        <Route path="/pedido/:id/confirmacion" element={<PedidoConfirmacionPage />} />

        <Route element={<PrivateRoute />}>
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/cuenta/pedidos" element={<MisPedidosPage />} />
          <Route path="/cuenta/perfil" element={<PerfilPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
