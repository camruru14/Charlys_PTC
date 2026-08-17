import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-secondary/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
            <span className="inline-block h-3 w-3 rounded-full bg-primary" />
            Industrias Charly
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Fabricamos pelotas y pajillas plásticas de alta calidad para eventos,
            negocios y distribuidores en todo El Salvador.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tienda
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link to="/productos" className="hover:text-primary">Todos los productos</Link></li>
            <li><Link to="/productos?category=Pelotas" className="hover:text-primary">Pelotas plásticas</Link></li>
            <li><Link to="/productos?category=Pajillas" className="hover:text-primary">Pajillas plásticas</Link></li>
            <li><Link to="/carrito" className="hover:text-primary">Carrito</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Empresa
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link to="/beneficios" className="hover:text-primary">Beneficios</Link></li>
            <li><Link to="/contacto" className="hover:text-primary">Contacto</Link></li>
            <li><Link to="/cuenta/pedidos" className="hover:text-primary">Mis pedidos</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Contacto
          </p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>ventas@industriascharly.com</li>
            <li>+503 0000 0000</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Industrias Charly. Todos los derechos reservados.
      </div>
    </footer>
  );
}
