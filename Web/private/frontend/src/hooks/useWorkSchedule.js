import { useMemo } from "react";
import { useFetch } from "./useFetch";
import { DEFAULT_WORK_SCHEDULE } from "../lib/attendance";

/*
  Horario laboral de la empresa (GET /settings/work-schedule), editable en
  Configuración > Empresa. Mientras carga (o si falla) se usan los mismos
  valores por defecto que responde el backend.
*/
export function useWorkSchedule() {
  const { data, loading, error, refetch } = useFetch("/settings/work-schedule");
  const schedule = useMemo(
    () => ({
      startTime: data?.startTime || DEFAULT_WORK_SCHEDULE.startTime,
      workdayHours: Number(data?.workdayHours) || DEFAULT_WORK_SCHEDULE.workdayHours,
    }),
    [data],
  );
  return { schedule, loading, error, refetch };
}

export default useWorkSchedule;
