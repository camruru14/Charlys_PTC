import { useMemo } from "react";
import { useApi } from "./useApi";
import { DEFAULT_WORK_SCHEDULE } from "../lib/attendance";

// Horario laboral de la empresa (GET /settings/work-schedule), el mismo que
// usa la web para «Tarde» y las horas extra. Mientras carga (o si falla) se
// usan los mismos valores por defecto que responde el backend.
export function useWorkSchedule() {
  const { data, loading, error, refresh } = useApi("/settings/work-schedule");
  const schedule = useMemo(
    () => ({
      startTime: data?.startTime || DEFAULT_WORK_SCHEDULE.startTime,
      workdayHours: Number(data?.workdayHours) || DEFAULT_WORK_SCHEDULE.workdayHours,
    }),
    [data],
  );
  return { schedule, loaded: Boolean(data), loading, error, refresh };
}

export default useWorkSchedule;
