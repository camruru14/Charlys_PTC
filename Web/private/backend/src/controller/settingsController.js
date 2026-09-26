const settingsController = {};

import workScheduleModel, { DEFAULT_WORK_SCHEDULE } from "../models/WorkSchedule.js";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const toSchedule = (doc) => ({
  startTime: doc?.startTime ?? DEFAULT_WORK_SCHEDULE.startTime,
  workdayHours: doc?.workdayHours ?? DEFAULT_WORK_SCHEDULE.workdayHours,
});

// GET /settings/work-schedule. Sin documento guardado, responde los valores
// por defecto (no escribe nada).
settingsController.getWorkSchedule = async (req, res) => {
  try {
    res.json(toSchedule(await workScheduleModel.findOne()));
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// PUT /settings/work-schedule { startTime, workdayHours }
settingsController.updateWorkSchedule = async (req, res) => {
  const { startTime } = req.body;
  const workdayHours = Number(req.body.workdayHours);

  if (typeof startTime !== "string" || !TIME_PATTERN.test(startTime)) {
    return res.status(400).json({ message: "La hora de entrada debe tener el formato HH:MM" });
  }
  if (!Number.isFinite(workdayHours) || workdayHours <= 0 || workdayHours > 24) {
    return res.status(400).json({ message: "Las horas de jornada deben ser mayores que 0 y hasta 24" });
  }

  try {
    const saved = await workScheduleModel.findOneAndUpdate(
      {},
      { startTime, workdayHours },
      { upsert: true, returnDocument: "after", runValidators: true },
    );
    res.json(toSchedule(saved));
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

export default settingsController;
