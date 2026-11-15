const mongoose = require("mongoose");
const Sala = require("../models/Sala");
const ConfiguracionClase = require("../models/ConfiguracionClase");
const HorarioClase = require("../models/HorarioClase");
const ClaseProgramada = require("../models/ClaseProgramada");
const Profesional = require("../models/Profesional");
const { crearError } = require("../helpers/errores");

const ZONA_HORARIA = "America/Argentina/Buenos_Aires";
const SEMANAS_ADELANTE = 8;
let colaDeCambios = Promise.resolve();

const encolarCambio = (operacion) => {
  const tarea = colaDeCambios.then(operacion, operacion);
  colaDeCambios = tarea.catch(() => {});
  return tarea;
};
const horaActualEnArgentina = () =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONA_HORARIA,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value])
  );

const fechaActualEnArgentina = () => {
  const { year, month, day } = horaActualEnArgentina();
  return `${year}-${month}-${day}`;
};

const sumarMinutos = (hora, minutos) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
    throw crearError(400, "La hora debe tener el formato HH:mm");
  }
  const [horas, mins] = hora.split(":").map(Number);
  const total = horas * 60 + mins + minutos;
  if (total >= 24 * 60) throw crearError(400, "La clase debe terminar antes de la medianoche");
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

const haySuperposicion = (inicioA, finA, inicioB, finB) => inicioA < finB && inicioB < finA;

const obtenerConfiguracion = async () => {
  const configuracion = await ConfiguracionClase.findOne({ clave: "general" });
  return configuracion || { duracionMinutos: 60 };
};

const validarHorario = async ({ horario, excluirId }) => {
  const [sala, profesional, configuracion] = await Promise.all([
    Sala.findOne({ _id: horario.sala, activa: true }),
    Profesional.findById(horario.profesional),
    obtenerConfiguracion(),
  ]);
  if (!sala) throw crearError(400, "La sala seleccionada no está disponible");
  if (!profesional) throw crearError(400, "El profesional vinculado no existe");

  const horaFin = sumarMinutos(horario.horaInicio, configuracion.duracionMinutos);
  const filtros = { diaSemana: horario.diaSemana, activo: true };
  if (excluirId) filtros._id = mongoose.trusted({ $ne: excluirId });
  const horarios = await HorarioClase.find(filtros);
  const salaIds = new Set([String(horario.sala)]);
  const profesionalIds = new Set([String(horario.profesional)]);
  const candidatos = horarios.filter(
    (otro) =>
      salaIds.has(String(otro.sala)) || profesionalIds.has(String(otro.profesional))
  );

  for (const otro of candidatos) {
    const finOtro = sumarMinutos(otro.horaInicio, configuracion.duracionMinutos);
    if (
      haySuperposicion(horario.horaInicio, horaFin, otro.horaInicio, finOtro) &&
      (String(otro.sala) === String(horario.sala) ||
        String(otro.profesional) === String(horario.profesional))
    ) {
      throw crearError(
        409,
        String(otro.sala) === String(horario.sala)
          ? "La sala ya está ocupada en ese horario"
          : "El profesor ya tiene una clase en ese horario"
      );
    }
  }

  const fechaDesde = fechaActualEnArgentina();
  const clasesConReservas = await ClaseProgramada.find({
    fecha: mongoose.trusted({ $gte: fechaDesde }),
    reservas: mongoose.trusted({ $gt: 0 }),
    activa: true,
  });
  const zonaHoy = new Date(`${fechaDesde}T12:00:00Z`);
  const dias = [];
  for (let i = 0; i < SEMANAS_ADELANTE * 7; i += 1) {
    const fecha = new Date(zonaHoy.getTime() + i * 86400000);
    if (fecha.getUTCDay() === horario.diaSemana) {
      dias.push(fecha.toISOString().slice(0, 10));
    }
  }
  const horaHoy = horaActualEnArgentina();
  for (const clase of clasesConReservas) {
    const ahoraTexto = `${horaHoy.year}-${horaHoy.month}-${horaHoy.day}T${horaHoy.hour}:${horaHoy.minute}`;
    if (`${clase.fecha}T${clase.horaInicio}` <= ahoraTexto) continue;
    const mismaClaseSinCambios =
      excluirId &&
      String(clase.horario) === String(excluirId) &&
      String(clase.sala) === String(horario.sala) &&
      String(clase.profesional) === String(horario.profesional) &&
      clase.horaInicio === horario.horaInicio;
    if (
      !dias.includes(clase.fecha) ||
      mismaClaseSinCambios ||
      (String(clase.sala) !== String(horario.sala) &&
        String(clase.profesional) !== String(horario.profesional))
    ) {
      continue;
    }
    const finClase = clase.horaFin;
    if (
      haySuperposicion(horario.horaInicio, horaFin, clase.horaInicio, finClase) &&
      (String(clase.sala) === String(horario.sala) ||
        String(clase.profesional) === String(horario.profesional))
    ) {
      throw crearError(409, "El cambio se superpone con una clase futura que ya tiene reservas");
    }
  }

  return { sala, configuracion, horaFin };
};

const refrescarClasesFuturas = async (idHorario) => {
  await ClaseProgramada.deleteMany({
    horario: idHorario,
    fecha: mongoose.trusted({ $gte: fechaActualEnArgentina() }),
    reservas: 0,
  });
};

const generarClasesFuturas = () =>
  encolarCambio(async () => {
    const horarios = await HorarioClase.find({ activo: true }).populate("sala", "capacidad activa");
    const { duracionMinutos } = await obtenerConfiguracion();
    const ahora = horaActualEnArgentina();
    const fechaBase = new Date(`${ahora.year}-${ahora.month}-${ahora.day}T12:00:00Z`);
    const fechaHoraAhora = `${ahora.year}-${ahora.month}-${ahora.day}T${ahora.hour}:${ahora.minute}`;

    for (const horario of horarios) {
      if (!horario.sala || !horario.sala.activa) continue;
      for (let dia = 0; dia < SEMANAS_ADELANTE * 7; dia += 1) {
        const fecha = new Date(fechaBase.getTime() + dia * 86400000);
        if (fecha.getUTCDay() !== horario.diaSemana) continue;
        const fechaTexto = fecha.toISOString().slice(0, 10);
        if (`${fechaTexto}T${horario.horaInicio}` <= fechaHoraAhora) continue;

        const horaFin = sumarMinutos(horario.horaInicio, duracionMinutos);
        const mismaFecha = await ClaseProgramada.find({
          fecha: fechaTexto,
          activa: true,
          $or: [{ sala: horario.sala._id }, { profesional: horario.profesional }],
        });
        const seSuperpone = mismaFecha.some((clase) =>
          haySuperposicion(horario.horaInicio, horaFin, clase.horaInicio, clase.horaFin)
        );
        if (seSuperpone) continue;

        try {
          await ClaseProgramada.updateOne(
            { horario: horario._id, fecha: fechaTexto },
            {
              $setOnInsert: {
                horario: horario._id,
                fecha: fechaTexto,
                tipo: horario.tipo,
                profesional: horario.profesional,
                sala: horario.sala._id,
                horaInicio: horario.horaInicio,
                horaFin,
                capacidad: horario.sala.capacidad,
                reservas: 0,
                activa: true,
              },
            },
            { upsert: true }
          );
        } catch (error) {
          if (error.code !== 11000) throw error;
          const ocurrencia = await ClaseProgramada.exists({
            horario: horario._id,
            fecha: fechaTexto,
          });
          if (!ocurrencia) throw error;
        }
      }
    }
  });

const obtenerClasesDisponibles = async () => {
  await generarClasesFuturas();
  const ahora = horaActualEnArgentina();
  const fechaHasta = new Date(`${fechaActualEnArgentina()}T12:00:00Z`);
  fechaHasta.setUTCDate(fechaHasta.getUTCDate() + SEMANAS_ADELANTE * 7);
  const clases = await ClaseProgramada.find({
    fecha: mongoose.trusted({
      $gte: fechaActualEnArgentina(),
      $lte: fechaHasta.toISOString().slice(0, 10),
    }),
    activa: true,
  })
    .populate("profesional", "nombre apellido")
    .populate("sala", "nombre capacidad")
    .sort({ fecha: 1, horaInicio: 1 });
  const fechaHoraAhora = `${ahora.year}-${ahora.month}-${ahora.day}T${ahora.hour}:${ahora.minute}`;
  return clases.filter((clase) => `${clase.fecha}T${clase.horaInicio}` > fechaHoraAhora);
};

module.exports = {
  ZONA_HORARIA,
  SEMANAS_ADELANTE,
  encolarCambio,
  sumarMinutos,
  validarHorario,
  refrescarClasesFuturas,
  obtenerClasesDisponibles,
  generarClasesFuturas,
};
