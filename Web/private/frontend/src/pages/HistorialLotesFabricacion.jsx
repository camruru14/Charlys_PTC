import BatchHistoryView from "../components/batches/BatchHistoryView";

// "Ver todo" de Fabricación.
function HistorialLotesFabricacion() {
  return <BatchHistoryView backTo="/fabricacion" backLabel="Volver a Fabricación" editable />;
}

export default HistorialLotesFabricacion;
