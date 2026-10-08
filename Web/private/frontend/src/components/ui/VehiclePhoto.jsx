import { IconTruck } from "../../lib/icons";

/*
  Foto de un vehículo (object-cover) o, si no tiene, un camión sobre fondo
  gris. La usan la lista y el detalle de Configuración > Vehículos y la ficha
  de la unidad en Logística > Para despacho.
    <VehiclePhoto url={v.image?.url} className="h-[44px] w-[72px] rounded-[8px]" iconSize={20} />
  El tamaño y las esquinas los define quien la usa, vía className.
*/
function VehiclePhoto({ url, alt = "Foto del vehículo", className = "", iconSize = 24 }) {
  if (url) {
    return <img src={url} alt={alt} className={`block shrink-0 bg-surface-2 object-cover ${className}`} />;
  }
  return (
    <span className={`flex shrink-0 items-center justify-center bg-canvas text-faint ${className}`} aria-hidden="true">
      <IconTruck width={iconSize} height={iconSize} strokeWidth={1.4} />
    </span>
  );
}

export default VehiclePhoto;
