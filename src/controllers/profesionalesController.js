const mongoose = require("mongoose");
const Profesional = require("../models/Profesional");
const HorarioClase = require("../models/HorarioClase");
const ClaseProgramada = require("../models/ClaseProgramada");
const ReservaClase = require("../models/ReservaClase");
const Usuario = require("../models/Usuario");
const { tomarCampos, describirCambios } = require("../helpers/campos");
const { registrarAuditoria } = require("../helpers/auditoria");

const CAMPOS = ["nombre", "apellido", "especialidad", "matricula"];
const fechaActualEnArgentina = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const obtenerProfesionales = async (req, res) => {
  const profesionales = await Profesional.find().sort({ apellido: 1, nombre: 1 });
  res.json(profesionales);
};

const obtenerProfesionalPorId = async (req, res) => {
  const profesional = await Profesional.findById(req.params.id);
  if (!profesional) return res.status(404).json({ error: "Profesional no encontrado" });
  res.json(profesional);
};

const crearProfesional = async (req, res) => {
  const profesional = await Profesional.create(tomarCampos(req.body, CAMPOS));
  await registrarAuditoria(req, "CREAR", {
    entidad: "Profesional",
    entidadId: profesional._id,
    detalle: `${profesional.nombre} ${profesional.apellido} (Mat. ${profesional.matricula})`,
  });
  res.status(201).json(profesional);
};

const actualizarProfesional = async (req, res) => {
  const profesional = await Profesional.findById(req.params.id);
  if (!profesional) return res.status(404).json({ error: "Profesional no encontrado" });

  profesional.set(tomarCampos(req.body, CAMPOS));
  const cambios = describirCambios(profesional);
  await profesional.save();

  await registrarAuditoria(req, "MODIFICAR", {
    entidad: "Profesional",
    entidadId: profesional._id,
    detalle: `Campos: ${cambios}`,
  });
  res.json(profesional);
};

const eliminarProfesional = async (req, res) => {
  const profesional = await Profesional.findById(req.params.id);
  if (!profesional) return res.status(404).json({ error: "Profesional no encontrado" });

  const tieneHorariosActivos = await HorarioClase.exists({
    profesional: profesional._id,
    activo: true,
  });
  const clasesFuturas = await ClaseProgramada.find({
    profesional: profesional._id,
    fecha: mongoose.trusted({ $gte: fechaActualEnArgentina() }),
  }).select("_id");
  const tieneReservasActivas =
    clasesFuturas.length > 0
      ? await ReservaClase.exists({
          clase: mongoose.trusted({ $in: clasesFuturas.map((clase) => clase._id) }),
          estado: "reservada",
        })
      : false;
  if (tieneHorariosActivos || tieneReservasActivas) {
    return res
      .status(409)
      .json({ error: "No se puede eliminar: el profesional tiene horarios activos o reservas de clases" });
  }

  const tieneUsuario = await Usuario.exists({ profesional: profesional._id });
  if (tieneUsuario) {
    return res
      .status(409)
      .json({ error: "No se puede eliminar: el profesional tiene un usuario vinculado" });
  }

  await profesional.deleteOne();
  await registrarAuditoria(req, "ELIMINAR", {
    entidad: "Profesional",
    entidadId: profesional._id,
    detalle: `${profesional.nombre} ${profesional.apellido} (Mat. ${profesional.matricula})`,
  });
  res.status(204).end();
};

module.exports = {
  obtenerProfesionales,
  obtenerProfesionalPorId,
  crearProfesional,
  actualizarProfesional,
  eliminarProfesional,
};
