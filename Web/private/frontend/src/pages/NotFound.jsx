import { Link } from "react-router-dom";
import { buttonClass } from "../lib/buttonStyles";

/*
  404 del panel privado: se renderiza DENTRO de Layout (ver App.jsx), así que
  conserva el menú lateral — el usuario nunca pierde la navegación, solo ve
  que esa ruta puntual no existe.
*/
function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-extrabold text-white">
        IC
      </span>
      <h1 className="t-page-title mt-6">Página no encontrada</h1>
      <p className="t-page-sub mt-2 max-w-md">
        La ruta que buscás no existe o fue movida. Revisá el menú lateral o volvé al Dashboard.
      </p>
      <Link to="/" className={`${buttonClass("primary", "header")} mt-8`}>
        Volver al Dashboard
      </Link>
    </div>
  );
}

export default NotFound;
