const settingsController = {};

import workScheduleModel, { DEFAULT_WORK_SCHEDULE } from "../models/WorkSchedule.js";
import companySettingsModel, { DEFAULT_COMPANY } from "../models/CompanySettings.js";
import cloudinary, { uploadLogoBuffer } from "../lib/cloudinary.js";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toSchedule = (doc) => ({
  startTime: doc?.startTime ?? DEFAULT_WORK_SCHEDULE.startTime,
  workdayHours: doc?.workdayHours ?? DEFAULT_WORK_SCHEDULE.workdayHours,
});

// updatedAt: null = todavía no se ha guardado nunca (el panel lo usa para
// ofrecer subir los datos que tenía en el navegador).
const toCompany = (doc) => ({
  name: doc?.name ?? DEFAULT_COMPANY.name,
  nit: doc?.nit ?? DEFAULT_COMPANY.nit,
  email: doc?.email ?? DEFAULT_COMPANY.email,
  phone: doc?.phone ?? DEFAULT_COMPANY.phone,
  address: doc?.address ?? DEFAULT_COMPANY.address,
  currency: doc?.currency ?? DEFAULT_COMPANY.currency,
  logoUrl: doc?.logo?.url || null,
  updatedAt: doc?.updatedAt || null,
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

// GET /settings/company. Sin documento guardado, responde los valores por
// defecto (no escribe nada).
settingsController.getCompany = async (req, res) => {
  try {
    res.json(toCompany(await companySettingsModel.findOne()));
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// PUT /settings/company { name, nit, email, phone, address }. La moneda no
// se recibe: el sistema solo maneja USD.
settingsController.updateCompany = async (req, res) => {
  const text = (v) => (typeof v === "string" ? v.trim() : "");
  const update = {
    name: text(req.body.name),
    nit: text(req.body.nit),
    email: text(req.body.email).toLowerCase(),
    phone: text(req.body.phone),
    address: text(req.body.address),
  };

  if (!update.name) return res.status(400).json({ message: "Escribe el nombre de la empresa" });
  if (update.email && !EMAIL_PATTERN.test(update.email)) {
    return res.status(400).json({ message: "El correo de contacto no es válido" });
  }

  try {
    const saved = await companySettingsModel.findOneAndUpdate({}, update, {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
      setDefaultsOnInsert: true,
    });
    res.json(toCompany(saved));
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// POST /settings/company/logo (multipart, campo "logo"). Sube el logo nuevo a
// Cloudinary, lo guarda y borra el anterior.
settingsController.updateLogo = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Selecciona una imagen" });

  try {
    const uploaded = await uploadLogoBuffer(req.file.buffer);
    const previous = await companySettingsModel.findOne();
    const saved = await companySettingsModel.findOneAndUpdate(
      {},
      { logo: { url: uploaded.secure_url, publicId: uploaded.public_id } },
      { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
    );
    const oldId = previous?.logo?.publicId;
    if (oldId && oldId !== uploaded.public_id) await cloudinary.uploader.destroy(oldId).catch(() => null);
    res.json(toCompany(saved));
  } catch (error) {
    console.log("error " + error);
    res.status(500).json({ message: error.message || "No se pudo subir el logo." });
  }
};

export default settingsController;
