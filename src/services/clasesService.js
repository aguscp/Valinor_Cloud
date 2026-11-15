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

const sumarDias = (fechaTexto, dias) => {
  const fecha = new Date(`${fechaTexto}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
};

const diaDeLaFecha = (fecha) => new Date(`${fecha}T12:00:00Z`).getUTCDay();

const esFechaValida = (fecha) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const fechaParseada = new Date(`${fecha}T00:00:00Z`);
  return (
    !Number.isNaN(fechaParseada.getTime()) &&
    fechaParseada.toISOString().slice(0, 10) === fecha
  );
};

const primeraFechaDeOcurrencia = (horario) => horario.comienzaDesde;

const ultimaFechaDeOcurrencia = (horario) =>
  sumarDias(
    primeraFechaDeOcurrencia(horario),
    (horario.repetirSemanas - 1) * 7
  );

const hayOcurrenciaEnComun = (horarioA, horarioB) => {
  if (diaDeLaFecha(horarioA.comienzaDesde) !== diaDeLaFecha(horarioB.comienzaDesde)) return false;
  return (
    primeraFechaDeOcurrencia(horarioA) <= ultimaFechaDeOcurrencia(horarioB) &&
    primeraFechaDeOcurrencia(horarioB) <= ultimaFechaDeOcurrencia(horarioA)
  );
};

const incluyeOcurrencia = (horario, fecha) => {
  const inicio = primeraFechaDeOcurrencia(horario);
  const fin = ultimaFechaDeOcurrencia(horario);
  return (
    fecha >= inicio &&
    fecha <= fin &&
    diaDeLaFecha(fecha) === diaDeLaFecha(inicio)
  );
};

const validarHorario = async ({ horario, excluirId }) => {
  if (!esFechaValida(horario.comienzaDesde)) {
    throw crearError(400, "La fecha de inicio no es válida");
  }
  if (
    !Number.isInteger(horario.repetirSemanas) ||
    horario.repetirSemanas < 1 ||
    horario.repetirSemanas > 8
  ) {
    throw crearError(400, "La repetición debe ser de 1 a 8 semanas");
  }
  const [sala, profesional, configuracion] = await Promise.all([
    Sala.findOne({ _id: horario.sala, activa: true }),
    Profesional.findById(horario.profesional),
    obtenerConfiguracion(),
  ]);
  if (!sala) throw crearError(400, "La sala seleccionada no está disponible");
  if (!profesional) throw crearError(400, "El profesional vinculado no existe");

  const horaFin = sumarMinutos(horario.horaInicio, configuracion.duracionMinutos);
  const filtros = { activo: true };
  if (excluirId) filtros._id = mongoose.trusted({ $ne: excluirId });
  const horarios = await HorarioClase.find(filtros);
  const salaIds = new Set([String(horario.sala)]);
  const profesionalIds = new Set([String(horario.profesional)]);
  const candidatos = horarios.filter(
    (otro) =>
      hayOcurrenciaEnComun(horario, otro) &&
      (salaIds.has(String(otro.sala)) || profesionalIds.has(String(otro.profesional)))
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
  const fechaInicioOcurrencias =
    primeraFechaDeOcurrencia(horario) > fechaDesde
      ? primeraFechaDeOcurrencia(horario)
      : fechaDesde;
  const fechaFinOcurrencias = ultimaFechaDeOcurrencia(horario);
  const clasesConReservas = await ClaseProgramada.find({
    fecha: mongoose.trusted({
      $gte: fechaInicioOcurrencias,
      $lte: fechaFinOcurrencias,
    }),
    reservas: mongoose.trusted({ $gt: 0 }),
    activa: true,
  });
  const dias = [];
  for (let semana = 0; semana < horario.repetirSemanas; semana += 1) {
    const fecha = sumarDias(primeraFechaDeOcurrencia(horario), semana * 7);
    if (fecha >= fechaDesde) dias.push(fecha);
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
    const [horarios, { duracionMinutos }] = await Promise.all([
      HorarioClase.find({ activo: true })
        .populate("sala", "capacidad activa")
        .lean(),
      obtenerConfiguracion(),
    ]);
    const ahora = horaActualEnArgentina();
    const fechaHoraAhora = `${ahora.year}-${ahora.month}-${ahora.day}T${ahora.hour}:${ahora.minute}`;
    const fechaHoy = `${ahora.year}-${ahora.month}-${ahora.day}`;
    const fechaFinHorizonte = sumarDias(
      fechaHoy,
      SEMANAS_ADELANTE * 7
    );
    const existentes = await ClaseProgramada.find({
      fecha: mongoose.trusted({ $gte: fechaHoy, $lt: fechaFinHorizonte }),
    }).lean();
    const clasesPorFecha = new Map();
    const horariosYFechasExistentes = new Set();
    for (const clase of existentes) {
      const lista = clasesPorFecha.get(clase.fecha) || [];
      lista.push(clase);
      clasesPorFecha.set(clase.fecha, lista);
      horariosYFechasExistentes.add(`${clase.horario}:${clase.fecha}`);
    }
    const operaciones = [];

    for (const horario of horarios) {
      if (!horario.sala || !horario.sala.activa) continue;
      for (let semana = 0; semana < horario.repetirSemanas; semana += 1) {
        const fechaTexto = sumarDias(primeraFechaDeOcurrencia(horario), semana * 7);
        if (
          fechaTexto < fechaHoy ||
          fechaTexto >= fechaFinHorizonte
        ) {
          continue;
        }
        if (`${fechaTexto}T${horario.horaInicio}` <= fechaHoraAhora) continue;
        const claveHorarioFecha = `${horario._id}:${fechaTexto}`;
        if (horariosYFechasExistentes.has(claveHorarioFecha)) continue;

        const horaFin = sumarMinutos(horario.horaInicio, duracionMinutos);
        const mismaFecha = clasesPorFecha.get(fechaTexto) || [];
        const seSuperpone = mismaFecha.some((clase) =>
          clase.activa &&
          (String(clase.sala) === String(horario.sala._id) ||
            String(clase.profesional) === String(horario.profesional)) &&
          haySuperposicion(horario.horaInicio, horaFin, clase.horaInicio, clase.horaFin)
        );
        if (seSuperpone) continue;

        const nuevaClase = {
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
        };
        operaciones.push({
          updateOne: {
            filter: { horario: horario._id, fecha: fechaTexto },
            update: { $setOnInsert: nuevaClase },
            upsert: true,
          },
        });
        horariosYFechasExistentes.add(claveHorarioFecha);
        mismaFecha.push(nuevaClase);
        clasesPorFecha.set(fechaTexto, mismaFecha);
      }
    }

    if (operaciones.length > 0) {
      await ClaseProgramada.bulkWrite(operaciones, { ordered: true });
    }
  });

const migrarHorariosConRepeticion = async () => {
  const comienzaDesde = fechaActualEnArgentina();
  const filtro = {
    $or: [
      { comienzaDesde: mongoose.trusted({ $exists: false }) },
      { repetirSemanas: mongoose.trusted({ $exists: false }) },
    ],
  };
  const idsActualizados = new Set(
    (await HorarioClase.find(filtro).select("_id")).map((horario) => String(horario._id))
  );
  await Promise.all([
    HorarioClase.updateMany(
      { comienzaDesde: mongoose.trusted({ $exists: false }) },
      { $set: { comienzaDesde } }
    ),
    HorarioClase.updateMany(
      { repetirSemanas: mongoose.trusted({ $exists: false }) },
      { $set: { repetirSemanas: SEMANAS_ADELANTE } }
    ),
  ]);

  const horariosAnteriores = HorarioClase.collection.find({
    diaSemana: { $exists: true },
    comienzaDesde: { $type: "string" },
  });
  for await (const horario of horariosAnteriores) {
    if (
      !Number.isInteger(horario.diaSemana) ||
      horario.diaSemana < 0 ||
      horario.diaSemana > 6 ||
      !esFechaValida(horario.comienzaDesde)
    ) {
      throw crearError(500, `No se pudo migrar el horario ${horario._id}: sus datos de día o fecha no son válidos`);
    }
    const diasHastaLaClase =
      (horario.diaSemana - diaDeLaFecha(horario.comienzaDesde) + 7) % 7;
    const nuevaFecha = sumarDias(horario.comienzaDesde, diasHastaLaClase);
    await HorarioClase.collection.updateOne(
      { _id: horario._id },
      {
        $set: { comienzaDesde: nuevaFecha },
        $unset: { diaSemana: "" },
      }
    );
    idsActualizados.add(String(horario._id));
  }
  return idsActualizados.size;
};

const obtenerClasesDisponibles = async ({ incluirSemanaActual = false } = {}) => {
  await generarClasesFuturas();
  const ahora = horaActualEnArgentina();
  const fechaHoy = fechaActualEnArgentina();
  const fechaDesde = incluirSemanaActual
    ? sumarDias(fechaHoy, -((diaDeLaFecha(fechaHoy) + 6) % 7))
    : fechaHoy;
  const fechaHasta = sumarDias(fechaHoy, SEMANAS_ADELANTE * 7);
  const clases = await ClaseProgramada.find({
    fecha: mongoose.trusted({
      $gte: fechaDesde,
      $lt: fechaHasta,
    }),
    activa: true,
  })
    .populate("profesional", "nombre apellido")
    .populate("sala", "nombre capacidad")
    .sort({ fecha: 1, horaInicio: 1 });
  if (incluirSemanaActual) return clases;
  const fechaHoraAhora = `${ahora.year}-${ahora.month}-${ahora.day}T${ahora.hour}:${ahora.minute}`;
  return clases.filter((clase) => `${clase.fecha}T${clase.horaInicio}` > fechaHoraAhora);
};

module.exports = {
  ZONA_HORARIA,
  SEMANAS_ADELANTE,
  encolarCambio,
  sumarMinutos,
  validarHorario,
  primeraFechaDeOcurrencia,
  ultimaFechaDeOcurrencia,
  hayOcurrenciaEnComun,
  incluyeOcurrencia,
  refrescarClasesFuturas,
  migrarHorariosConRepeticion,
  obtenerClasesDisponibles,
  generarClasesFuturas,
};
