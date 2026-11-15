const mongoose = require("mongoose");
const Cliente = require("../models/Cliente");
const Sala = require("../models/Sala");
const ConfiguracionClase = require("../models/ConfiguracionClase");
const HorarioClase = require("../models/HorarioClase");
const ClaseProgramada = require("../models/ClaseProgramada");
const ReservaClase = require("../models/ReservaClase");
const { tomarCampos } = require("../helpers/campos");
const { registrarAuditoria } = require("../helpers/auditoria");
const { crearError } = require("../helpers/errores");
const {
  encolarCambio,
  sumarMinutos,
  validarHorario,
  refrescarClasesFuturas,
  obtenerClasesDisponibles,
} = require("../services/clasesService");

const esProfesor = (usuario) => usuario.rol === "profesional";
const idProfesionalDe = (usuario) => (esProfesor(usuario) ? usuario.profesional : null);
const horaActualEnArgentina = () =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
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
  const ahora = horaActualEnArgentina();
  return `${ahora.year}-${ahora.month}-${ahora.day}`;
};

const obtenerConfiguracion = async (req, res) => {
  const configuracion = await ConfiguracionClase.findOne({ clave: "general" });
  res.json({ duracionMinutos: configuracion ? configuracion.duracionMinutos : 60 });
};

const actualizarConfiguracion = async (req, res) =>
  encolarCambio(async () => {
    const { duracionMinutos } = tomarCampos(req.body, ["duracionMinutos"]);
    const duracion = Number(duracionMinutos);
    if (!Number.isInteger(duracion) || duracion < 15 || duracion > 240) {
      return res.status(400).json({ error: "La duración debe ser un número entero entre 15 y 240 minutos" });
    }

    const horarios = await HorarioClase.find({ activo: true });
    const porDia = new Map();
    horarios.forEach((horario) => {
      if (!porDia.has(horario.diaSemana)) porDia.set(horario.diaSemana, []);
      porDia.get(horario.diaSemana).push(horario);
    });
    for (const delDia of porDia.values()) {
      for (let i = 0; i < delDia.length; i += 1) {
        const inicioA = delDia[i].horaInicio;
        const finA = sumarMinutos(inicioA, duracion);
        for (let j = i + 1; j < delDia.length; j += 1) {
          const mismoProfesor = String(delDia[i].profesional) === String(delDia[j].profesional);
          const mismaSala = String(delDia[i].sala) === String(delDia[j].sala);
          const inicioB = delDia[j].horaInicio;
          const finB = sumarMinutos(inicioB, duracion);
          if (inicioA < finB && inicioB < finA && (mismoProfesor || mismaSala)) {
            return res.status(409).json({
              error: "La duración configurada genera superposiciones entre horarios existentes",
            });
          }
        }
      }
    }

    const clasesConReservas = await ClaseProgramada.find({
      fecha: mongoose.trusted({ $gte: fechaActualEnArgentina() }),
      reservas: mongoose.trusted({ $gt: 0 }),
      activa: true,
    });
    for (const clase of clasesConReservas) {
      const diaSemana = new Date(`${clase.fecha}T12:00:00Z`).getUTCDay();
      for (const horario of horarios) {
        if (
          horario.diaSemana !== diaSemana ||
          String(horario._id) === String(clase.horario)
        ) {
          continue;
        }
        const mismoRecurso =
          String(clase.sala) === String(horario.sala) ||
          String(clase.profesional) === String(horario.profesional);
        if (!mismoRecurso) continue;
        const finNuevo = sumarMinutos(horario.horaInicio, duracion);
        if (horario.horaInicio < clase.horaFin && clase.horaInicio < finNuevo) {
          return res.status(409).json({
            error: "La duración configurada se superpone con clases futuras que ya tienen reservas",
          });
        }
      }
    }

    const configuracion = await ConfiguracionClase.findOneAndUpdate(
      { clave: "general" },
      { $set: { duracionMinutos: duracion } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    await ClaseProgramada.deleteMany({
      fecha: mongoose.trusted({ $gte: fechaActualEnArgentina() }),
      reservas: 0,
    });
    await registrarAuditoria(req, "MODIFICAR", {
      entidad: "ConfiguracionClase",
      detalle: `Duración general: ${configuracion.duracionMinutos} minutos`,
    });
    res.json({ duracionMinutos: configuracion.duracionMinutos });
  });

const obtenerSalas = async (req, res) => {
  const salas = await Sala.find().sort({ nombre: 1 });
  res.json(salas);
};

const crearSala = async (req, res) => {
  const sala = await Sala.create(tomarCampos(req.body, ["nombre", "capacidad"]));
  await registrarAuditoria(req, "CREAR", {
    entidad: "Sala",
    entidadId: sala._id,
    detalle: `${sala.nombre}, capacidad ${sala.capacidad}`,
  });
  res.status(201).json(sala);
};

const actualizarSala = async (req, res) =>
  encolarCambio(async () => {
    const sala = await Sala.findById(req.params.id);
    if (!sala) return res.status(404).json({ error: "Sala no encontrada" });
    const datos = tomarCampos(req.body, ["nombre", "capacidad", "activa"]);
    if (datos.capacidad !== undefined) datos.capacidad = Number(datos.capacidad);
    if (
      datos.activa !== undefined &&
      ![true, false, "true", "false"].includes(datos.activa)
    ) {
      return res.status(400).json({ error: "El estado de la sala no es válido" });
    }
    if (datos.activa !== undefined) datos.activa = datos.activa === true || datos.activa === "true";
    sala.set(datos);
    await sala.save();

    if (datos.capacidad !== undefined) {
      await ClaseProgramada.updateMany(
        {
          sala: sala._id,
          fecha: mongoose.trusted({ $gte: fechaActualEnArgentina() }),
          reservas: 0,
        },
        { $set: { capacidad: sala.capacidad } }
      );
    }
    if (!sala.activa) {
      const horarios = await HorarioClase.find({ sala: sala._id, activo: true });
      for (const horario of horarios) await refrescarClasesFuturas(horario._id);
    }

    await registrarAuditoria(req, "MODIFICAR", {
      entidad: "Sala",
      entidadId: sala._id,
      detalle: `${sala.nombre}, capacidad ${sala.capacidad}, ${sala.activa ? "activa" : "inactiva"}`,
    });
    res.json(sala);
  });

const obtenerHorarios = async (req, res) => {
  const filtro = esProfesor(req.usuario) ? { profesional: req.usuario.profesional } : {};
  const horarios = await HorarioClase.find(filtro)
    .populate("profesional", "nombre apellido")
    .populate("sala", "nombre capacidad activa")
    .sort({ diaSemana: 1, horaInicio: 1 });
  const configuracion = await ConfiguracionClase.findOne({ clave: "general" });
  res.json({
    duracionMinutos: configuracion ? configuracion.duracionMinutos : 60,
    horarios,
  });
};

const obtenerSalasDisponibles = async (req, res) => {
  const diaSemana = Number(req.query.diaSemana);
  const horaInicio = String(req.query.horaInicio || "");
  const profesional = idProfesionalDe(req.usuario);
  if (!Number.isInteger(diaSemana) || diaSemana < 0 || diaSemana > 6 || !profesional) {
    return res.status(400).json({ error: "Seleccioná un día y un horario válidos" });
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horaInicio)) {
    return res.status(400).json({ error: "Seleccioná un horario válido" });
  }
  const salas = await Sala.find({ activa: true }).sort({ nombre: 1 });
  const disponibles = [];
  for (const sala of salas) {
    try {
      await validarHorario({
        horario: { profesional, diaSemana, horaInicio, sala: sala._id },
        excluirId: req.query.excluirId,
      });
      disponibles.push(sala);
    } catch (error) {
      if (error.status !== 409 && error.status !== 400) throw error;
    }
  }
  res.json(disponibles);
};

const crearHorario = async (req, res) =>
  encolarCambio(async () => {
    const horario = new HorarioClase({
      ...tomarCampos(req.body, ["tipo", "diaSemana", "horaInicio", "sala"]),
      profesional: req.usuario.profesional,
      diaSemana: Number(req.body.diaSemana),
    });
    await horario.validate();
    await validarHorario({ horario });
    await horario.save();
    await registrarAuditoria(req, "CREAR", {
      entidad: "HorarioClase",
      entidadId: horario._id,
      detalle: `${horario.tipo}, día ${horario.diaSemana}, ${horario.horaInicio}`,
    });
    res.status(201).json(horario);
  });

const actualizarHorario = async (req, res) =>
  encolarCambio(async () => {
    const horario = await HorarioClase.findOne({
      _id: req.params.id,
      ...(esProfesor(req.usuario) ? { profesional: req.usuario.profesional } : {}),
    });
    if (!horario) return res.status(404).json({ error: "Horario no encontrado" });
    horario.set(tomarCampos(req.body, ["tipo", "diaSemana", "horaInicio", "sala", "activo"]));
    if (req.body.diaSemana !== undefined) horario.diaSemana = Number(req.body.diaSemana);
    if (req.body.activo !== undefined) horario.activo = req.body.activo === true || req.body.activo === "true";
    await horario.validate();
    if (horario.activo) await validarHorario({ horario, excluirId: horario._id });
    await horario.save();
    await refrescarClasesFuturas(horario._id);
    await registrarAuditoria(req, "MODIFICAR", {
      entidad: "HorarioClase",
      entidadId: horario._id,
      detalle: `${horario.tipo}, día ${horario.diaSemana}, ${horario.horaInicio}`,
    });
    res.json(horario);
  });

const eliminarHorario = async (req, res) =>
  encolarCambio(async () => {
    const horario = await HorarioClase.findOne({
      _id: req.params.id,
      ...(esProfesor(req.usuario) ? { profesional: req.usuario.profesional } : {}),
    });
    if (!horario) return res.status(404).json({ error: "Horario no encontrado" });
    horario.activo = false;
    await horario.save();
    await refrescarClasesFuturas(horario._id);
    await registrarAuditoria(req, "ELIMINAR", {
      entidad: "HorarioClase",
      entidadId: horario._id,
      detalle: `${horario.tipo}, día ${horario.diaSemana}, ${horario.horaInicio}`,
    });
    res.status(204).end();
  });

const obtenerClasesDisponiblesCliente = async (req, res) => {
  const clases = await obtenerClasesDisponibles();
  const reservas = await ReservaClase.find({
    cliente: req.usuario.cliente,
    estado: "reservada",
  }).select("clase");
  const reservadas = new Set(reservas.map((reserva) => String(reserva.clase)));
  res.json(
    clases.map((clase) => ({
      ...clase.toJSON(),
      reservadaPorMi: reservadas.has(String(clase._id)),
    }))
  );
};

const obtenerClasesParaReserva = async (req, res) => {
  const clases = await obtenerClasesDisponibles();
  res.json(clases);
};

const crearReservaDeClase = async ({ req, res, clienteId }) => {
  const clase = await ClaseProgramada.findById(req.params.id);
  if (!clase || !clase.activa) {
    return res.status(404).json({ error: "La clase no está disponible" });
  }
  const ahora = horaActualEnArgentina();
  if (
    `${clase.fecha}T${clase.horaInicio}` <=
    `${ahora.year}-${ahora.month}-${ahora.day}T${ahora.hour}:${ahora.minute}`
  ) {
    return res.status(400).json({ error: "Solo podés reservar clases futuras" });
  }

  if (clase.horaFin <= clase.horaInicio) {
    return res.status(409).json({ error: "El horario de la clase no es válido" });
  }
  const reservaAsistida = await ReservaClase.exists({
    clase: clase._id,
    cliente: clienteId,
    estado: "asistida",
  });
  if (reservaAsistida) {
    return res.status(409).json({ error: "Ya asististe a esta clase" });
  }
  const reservaExistente = await ReservaClase.exists({
    clase: clase._id,
    cliente: clienteId,
    estado: "reservada",
  });
  if (reservaExistente) {
    return res.status(409).json({ error: "Ya reservaste un lugar en esta clase" });
  }

  const reservasDelCliente = await ReservaClase.find({
    cliente: clienteId,
    estado: "reservada",
  }).populate("clase");
  for (const reserva of reservasDelCliente) {
    const otra = reserva.clase;
    if (!otra || otra.fecha !== clase.fecha) continue;
    if (clase.horaInicio < otra.horaFin && otra.horaInicio < clase.horaFin) {
      return res.status(409).json({ error: "Ya tenés una clase reservada en ese horario" });
    }
  }
  const claseConCupo = await ClaseProgramada.findOneAndUpdate(
    {
      _id: clase._id,
      activa: true,
      fecha: mongoose.trusted({ $gte: fechaActualEnArgentina() }),
      reservas: mongoose.trusted({ $lt: clase.capacidad }),
    },
    { $inc: { reservas: 1 } },
    { new: true }
  );
  if (!claseConCupo) {
    return res.status(409).json({ error: "La clase ya está completa" });
  }

  let reserva;
  try {
    [reserva] = await ReservaClase.create([{ clase: clase._id, cliente: clienteId }]);
  } catch (error) {
    await ClaseProgramada.updateOne({ _id: clase._id }, { $inc: { reservas: -1 } });
    if (error.code === 11000) {
      return res.status(409).json({ error: "Ya reservaste un lugar en esta clase" });
    }
    throw error;
  }
  await registrarAuditoria(req, "CREAR", {
    entidad: "ReservaClase",
    entidadId: reserva._id,
    detalle: `${clase.tipo} - ${clase.fecha} ${clase.horaInicio}; cliente ${clienteId}`,
  });
  res.status(201).json(reserva);
};

const reservarClase = async (req, res) =>
  encolarCambio(async () => {
    if (!req.usuario.cliente) {
      return res.status(403).json({ error: "La cuenta no tiene un cliente vinculado" });
    }
    return crearReservaDeClase({ req, res, clienteId: req.usuario.cliente });
  });

const reservarClaseParaCliente = async (req, res) =>
  encolarCambio(async () => {
    const { cliente: clienteId } = tomarCampos(req.body, ["cliente"]);
    if (!clienteId) {
      return res.status(400).json({ error: "Seleccioná un cliente" });
    }
    const clienteExiste = await Cliente.exists({ _id: clienteId });
    if (!clienteExiste) {
      return res.status(400).json({ error: "El cliente seleccionado no existe" });
    }
    return crearReservaDeClase({ req, res, clienteId });
  });

const obtenerMisReservas = async (req, res) => {
  if (!req.usuario.cliente) {
    return res.status(403).json({ error: "La cuenta no tiene un cliente vinculado" });
  }
  const reservas = await ReservaClase.find({ cliente: req.usuario.cliente })
    .populate({
      path: "clase",
      populate: [
        { path: "profesional", select: "nombre apellido" },
        { path: "sala", select: "nombre capacidad" },
      ],
    })
    .sort({ createdAt: -1 });
  res.json(reservas);
};

const obtenerReservas = async (req, res) => {
  const filtroClases = {};
  if (req.usuario.rol === "cliente" && !req.usuario.cliente) {
    return res.status(403).json({ error: "La cuenta no tiene un cliente vinculado" });
  }
  if (esProfesor(req.usuario) && !req.usuario.profesional) {
    return res.status(403).json({ error: "La cuenta no tiene un profesional vinculado" });
  }
  if (req.query.fecha) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query.fecha)) {
      return res.status(400).json({ error: "La fecha no es válida" });
    }
    filtroClases.fecha = req.query.fecha;
  }
  if (esProfesor(req.usuario)) {
    filtroClases.profesional = req.usuario.profesional;
  }

  const clases = await ClaseProgramada.find(filtroClases)
    .select("_id")
    .sort({ fecha: 1, horaInicio: 1 });
  const filtroReservas = {
    clase: mongoose.trusted({ $in: clases.map((clase) => clase._id) }),
  };
  if (req.usuario.rol === "cliente") filtroReservas.cliente = req.usuario.cliente;
  if (req.query.estado) {
    if (!["reservada", "asistida", "cancelada"].includes(req.query.estado)) {
      return res.status(400).json({ error: "El estado no es válido" });
    }
    filtroReservas.estado = req.query.estado;
  }

  const reservas = await ReservaClase.find(filtroReservas)
    .populate("cliente", "nombre apellido dni")
    .populate({
      path: "clase",
      populate: [
        { path: "profesional", select: "nombre apellido" },
        { path: "sala", select: "nombre capacidad" },
      ],
    })
    .sort({ createdAt: -1 });
  const ordenClases = new Map(clases.map((clase, indice) => [String(clase._id), indice]));
  reservas.sort(
    (a, b) => ordenClases.get(String(a.clase?._id)) - ordenClases.get(String(b.clase?._id))
  );
  res.json(reservas);
};

const cancelarReserva = async (req, res, soloCliente) =>
  encolarCambio(async () => {
    const reserva = await ReservaClase.findById(req.params.id).populate("clase");
    if (!reserva) return res.status(404).json({ error: "Reserva no encontrada" });
    if (reserva.estado !== "reservada") {
      return res.status(409).json({ error: "Solo se pueden cancelar reservas activas" });
    }
    if (!reserva.clase) {
      return res.status(409).json({ error: "La clase asociada a la reserva no existe" });
    }
    if (soloCliente) {
      if (
        !req.usuario.cliente ||
        String(reserva.cliente) !== String(req.usuario.cliente)
      ) {
        return res.status(403).json({ error: "Solo podés cancelar tus propias reservas" });
      }
      const ahora = horaActualEnArgentina();
      if (
        `${reserva.clase.fecha}T${reserva.clase.horaInicio}` <=
          `${ahora.year}-${ahora.month}-${ahora.day}T${ahora.hour}:${ahora.minute}`
      ) {
        return res.status(400).json({ error: "Solo podés cancelar antes del inicio de la clase" });
      }
    } else if (!["admin", "recepcion"].includes(req.usuario.rol)) {
      return res.status(403).json({ error: "No tenés permiso para cancelar esta reserva" });
    }
    const cancelada = await ReservaClase.findOneAndUpdate(
      { _id: reserva._id, estado: "reservada" },
      { $set: { estado: "cancelada" } },
      { new: true }
    );
    if (!cancelada) {
      return res.status(409).json({ error: "La reserva cambió mientras se procesaba" });
    }
    const cupoLiberado = await ClaseProgramada.updateOne(
      {
        _id: reserva.clase._id,
        reservas: mongoose.trusted({ $gt: 0 }),
      },
      { $inc: { reservas: -1 } }
    );
    if (cupoLiberado.modifiedCount !== 1) {
      await ReservaClase.updateOne(
        { _id: cancelada._id, estado: "cancelada" },
        { $set: { estado: "reservada" } }
      );
      return res.status(409).json({ error: "No se pudo liberar el cupo de la clase" });
    }

    await registrarAuditoria(req, "CAMBIO_ESTADO", {
      entidad: "ReservaClase",
      entidadId: cancelada._id,
      detalle: `Cancelada: ${reserva.clase.tipo} - ${reserva.clase.fecha} ${reserva.clase.horaInicio}; cliente ${reserva.cliente}`,
    });
    res.json(cancelada);
  });

const cancelarReservaCliente = (req, res) => cancelarReserva(req, res, true);
const cancelarReservaPersonal = (req, res) => cancelarReserva(req, res, false);

const marcarAsistencia = async (req, res) =>
  encolarCambio(async () => {
    const reserva = await ReservaClase.findById(req.params.id).populate("clase");
    if (!reserva) return res.status(404).json({ error: "Reserva no encontrada" });
    if (reserva.estado !== "reservada") {
      return res.status(409).json({ error: "Solo se puede marcar asistencia en reservas activas" });
    }
    if (!reserva.clase) {
      return res.status(409).json({ error: "La clase asociada a la reserva no existe" });
    }
    if (esProfesor(req.usuario)) {
      if (!reserva.clase || String(reserva.clase.profesional) !== String(req.usuario.profesional)) {
        return res.status(403).json({ error: "Solo podés marcar asistencia en tus propias clases" });
      }
    } else if (req.usuario.rol !== "admin") {
      return res.status(403).json({ error: "No tenés permiso para marcar asistencia" });
    }

    const actualizada = await ReservaClase.findOneAndUpdate(
      { _id: reserva._id, estado: "reservada" },
      { $set: { estado: "asistida" } },
      { new: true }
    );
    if (!actualizada) {
      return res.status(409).json({ error: "La reserva cambió mientras se procesaba" });
    }
    await registrarAuditoria(req, "CAMBIO_ESTADO", {
      entidad: "ReservaClase",
      entidadId: actualizada._id,
      detalle: `Asistencia: ${reserva.clase.tipo} - ${reserva.clase.fecha} ${reserva.clase.horaInicio}; cliente ${reserva.cliente}`,
    });
    res.json(actualizada);
  });

const eliminarReservaCancelada = async (req, res) => {
  const reserva = await ReservaClase.findById(req.params.id).populate("clase");
  if (!reserva) return res.status(404).json({ error: "Reserva no encontrada" });
  if (reserva.estado !== "cancelada") {
    return res.status(409).json({ error: "Solo se pueden eliminar reservas canceladas" });
  }
  await reserva.deleteOne();
  await registrarAuditoria(req, "ELIMINAR", {
    entidad: "ReservaClase",
    entidadId: reserva._id,
    detalle: `Eliminada: ${reserva.clase?.tipo || "clase"} - ${reserva.clase?.fecha || "fecha desconocida"}; cliente ${reserva.cliente}`,
  });
  res.status(204).end();
};

module.exports = {
  obtenerConfiguracion,
  actualizarConfiguracion,
  obtenerSalas,
  crearSala,
  actualizarSala,
  obtenerHorarios,
  obtenerSalasDisponibles,
  crearHorario,
  actualizarHorario,
  eliminarHorario,
  obtenerClasesDisponiblesCliente,
  obtenerClasesParaReserva,
  reservarClase,
  reservarClaseParaCliente,
  obtenerMisReservas,
  obtenerReservas,
  cancelarReservaCliente,
  cancelarReservaPersonal,
  marcarAsistencia,
  eliminarReservaCancelada,
};
