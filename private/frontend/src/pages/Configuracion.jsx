import ModulePlaceholder from "../components/ui/ModulePlaceholder";
import { IconSettings } from "../lib/icons";

function Configuracion() {
  return (
    <ModulePlaceholder
      icon={IconSettings}
      title="Configuración"
      description="Ajusta las preferencias del sistema, la información de la empresa, los roles de usuario y las integraciones del panel administrativo."
      cta="Editar preferencias"
      features={[
        "Datos de la empresa",
        "Roles y permisos",
        "Integración con e-commerce",
        "Notificaciones y alertas",
      ]}
    />
  );
}

export default Configuracion;
