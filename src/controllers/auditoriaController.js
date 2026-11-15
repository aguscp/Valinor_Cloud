const mongoose = require("mongoose");
const Auditoria = require("../models/Auditoria");
const Cliente = require("../models/Cliente");
const Profesional = require("../models/Profesional");
const Usuario = require("../models/Usuario");
const Sala = require("../models/Sala");
const HorarioClase = require("../models/HorarioClase");
const ReservaClase = require("../models/ReservaClase");
const Chat = require("../models/Chat");

const ENTIDADES = {
  Cliente: "Cliente",
  Profesional: "Profesional",
  Usuario: "Usuario",
  Sala: "Sala",
  ConfiguracionClase: "Configuración de clases",
  HorarioClase: "Horario de clase",
  ClaseProgramada: "Clase",
  ReservaClase: "Reserva de clase",
  Chat: "Consulta por chat",
};

const ACCIONES = {
  LOGIN: "Inicio de sesión",
  LOGIN_FALLIDO: "Inicio de sesión fallido",
  LOGOUT: "Cierre de sesión",
  CREAR: "Creación",
  MODIFICAR: "Modificación",
  ELIMINAR: "Eliminación",
  CAMBIO_ESTADO: "Cambio de estado",
  ACCESO_DENEGADO: "Acceso denegado",
  SESION_REVOCADA: "Sesión revocada",
  CHAT_SIN_OPERADOR: "Sin operador disponible",
};

const CAMPOS = {
  nombre: "nombre",
  apellido: "apellido",
  dni: "DNI",
  telefono: "teléfono",
  email: "correo electrónico",
  usuario: "nombre de usuario",
  password: "contraseña",
  rol: "rol",
  profesional: "profesional vinculado",
  cliente: "cliente vinculado",
  activo: "estado de la cuenta",
  expiraEl: "vencimiento de la cuenta",
  especialidad: "especialidad",
  matricula: "matrícula",
  capacidad: "capacidad",
  tipo: "actividad",
  comienzaDesde: "fecha de inicio",
  repetirSemanas: "semanas de repetición",
  horaInicio: "hora de inicio",
  sala: "sala",
};

const ROLES = {
  admin: "administrador",
  recepcion: "recepción",
  profesional: "profesional",
  cliente: "cliente",
};

const ETIQUETAS_PERMISOS = {
  "clientes:read": "ver clientes",
  "clientes:create": "crear clientes",
  "clientes:update": "modificar clientes",
  "clientes:delete": "eliminar clientes",
  "profesionales:read": "ver profesionales",
  "profesionales:create": "crear profesionales",
  "profesionales:update": "modificar profesionales",
  "profesionales:delete": "eliminar profesionales",
  "usuarios:read": "ver usuarios",
  "usuarios:create": "crear usuarios",
  "usuarios:update": "modificar usuarios",
  "usuarios:delete": "eliminar usuarios",
  "turnos:read": "ver reservas",
  "turnos:create": "crear reservas",
  "turnos:update": "modificar reservas",
  "turnos:delete": "eliminar reservas",
  "clases:read": "ver clases",
  "clases:reservar": "reservar clases",
  "clases:cancelar": "cancelar reservas",
  "clases:gestionar": "gestionar horarios",
  "clases:configurar": "configurar clases",
  "auditoria:read": "ver auditoría",
  "chat:usar": "usar el chat",
  "chat:moderar": "administrar el chat",
  "salas:manage": "gestionar salas",
};

const esObjectId = (id) => mongoose.isValidObjectId(id);
const idsDe = (registros, entidad) =>
  [...new Set(
    registros
      .filter((registro) => registro.entidad === entidad && esObjectId(registro.entidadId))
      .map((registro) => registro.entidadId)
  )];

const buscarPorIds = (Modelo, ids, poblar = []) => {
  if (!ids.length) return Promise.resolve([]);
  let consulta = Modelo.find({ _id: mongoose.trusted({ $in: ids }) });
  for (const opcion of poblar) consulta = consulta.populate(opcion);
  return consulta.lean();
};

const nombrePersona = (persona) =>
  persona ? `${persona.nombre || ""} ${persona.apellido || ""}`.trim() : "";

const nombreCampo = (campo) => CAMPOS[campo] || campo;
const traducirCampos = (campos) =>
  campos.split(",").map((campo) => nombreCampo(campo.trim())).join(", ");

const fechaLegible = (fecha) => {
  const coincidencia = fecha?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return coincidencia ? `${coincidencia[3]}/${coincidencia[2]}/${coincidencia[1]}` : fecha;
};

const traducirDetalleReserva = (detalle) =>
  detalle
    .replace(/^Asistencia:/, "Asistencia marcada:")
    .replace(/^Cancelada:/, "Reserva cancelada:")
    .replace(/^Eliminada:/, "Reserva eliminada:");

const describirReserva = (registro, reserva, clientesPorId) => {
  const detalle = registro.detalle || "";
  const idClienteAnterior = detalle.match(/cliente ([a-f\d]{24})/i)?.[1];
  const cliente =
    reserva?.cliente ||
    (idClienteAnterior ? clientesPorId.get(idClienteAnterior.toLowerCase()) : null);
  const nombreCliente = nombrePersona(cliente) || "cliente no disponible";
  if (!reserva?.clase) {
    return traducirDetalleReserva(
      detalle
        .replace(/cliente [a-f\d]{24}/i, `cliente ${nombreCliente}`)
        .replace(/\b\d{4}-\d{2}-\d{2}\b/g, fechaLegible)
    );
  }

  const prefijo = detalle.split(":")[0];
  const operacion =
    prefijo === "Asistencia"
      ? "Asistencia marcada"
      : prefijo === "Cancelada"
        ? "Reserva cancelada"
        : prefijo === "Eliminada" || registro.accion === "ELIMINAR"
          ? "Reserva eliminada"
          : "Reserva creada";
  const { clase } = reserva;
  return `${operacion}: ${clase.tipo}, ${fechaLegible(clase.fecha)} a las ${clase.horaInicio}; cliente ${nombrePersona(reserva.cliente) || nombreCliente}`;
};

const describirAccesoDenegado = (detalle) => {
  const coincidencia = detalle?.match(/^([A-Z]+) ([^ ]+) requiere ([\w:-]+)$/);
  if (!coincidencia) return detalle;
  const [, metodo, ruta, permiso] = coincidencia;
  const rutaLegible = ruta.replace(/\/[a-f\d]{24}(?=\/|$)/gi, "/:id");
  const operacion = {
    GET: "consultó",
    POST: "intentó crear o enviar a",
    PUT: "intentó modificar",
    PATCH: "intentó actualizar",
    DELETE: "intentó eliminar",
  }[metodo] || "intentó acceder a";
  return `Intentó acceder a ${rutaLegible}, sin permiso para ${ETIQUETAS_PERMISOS[permiso] || permiso} (método ${metodo}).`;
};

const describirChat = (registro, chat) => {
  const detalle = registro.detalle || "";
  if (detalle.includes(" → ")) {
    if (detalle.includes("pendiente → activo")) return "La consulta fue aceptada por el operador.";
    if (detalle.includes("pendiente → rechazado")) return "La consulta fue rechazada por el operador.";
    if (detalle.includes("timeout")) return "La consulta venció antes de que un operador la aceptara.";
    if (detalle.includes("operador dado de baja")) return "La conversación se cerró porque se desactivó el operador.";
    if (detalle.includes("activo → finalizado")) return "El operador finalizó la conversación.";
  }
  if (detalle.includes("reasignada a")) {
    return detalle.replace("Consulta pendiente reasignada a", "Consulta pendiente reasignada al operador");
  }
  const solicitante = nombrePersona(chat?.solicitante) || chat?.solicitante?.usuario;
  const operador = chat?.admin?.usuario || detalle.match(/a ([\w.-]+)$/)?.[1];
  if (solicitante) {
    const rol = ROLES[chat.rolSolicitante] || "usuario";
    return operador
      ? `Consulta de ${solicitante} (${rol}), asignada a ${operador}.`
      : `Consulta iniciada por ${solicitante} (${rol}).`;
  }
  return detalle;
};

const describirModificacion = (detalle, entidad, documento) => {
  const coincidencia = detalle?.match(/^(.*?)?(?:Perfil propio - )?campos?: (.+)$/i);
  if (!coincidencia) return detalle;
  const [, prefijo, campos] = coincidencia;
  const nombre =
    nombrePersona(documento) ||
    documento?.usuario ||
    documento?.nombre ||
    documento?.nombre;
  const sujeto = nombre ? `${ENTIDADES[entidad] || entidad} ${nombre}` : ENTIDADES[entidad] || entidad;
  return `${sujeto}: se modificaron ${traducirCampos(campos)}.`;
};

const describirEvento = (registro, datos) => {
  if (registro.entidad === "ReservaClase") {
    return describirReserva(registro, datos.reservas.get(String(registro.entidadId)), datos.clientes);
  }
  if (registro.entidad === "Chat") {
    const detalleChat = describirChat(registro, datos.chats.get(String(registro.entidadId)));
    return detalleChat || "Operación sobre una consulta por chat.";
  }
  if (registro.accion === "ACCESO_DENEGADO") return describirAccesoDenegado(registro.detalle);

  const documento = datos.documentos.get(registro.entidad)?.get(String(registro.entidadId));
  let detalle = registro.detalle || "";
  if (registro.accion === "MODIFICAR") {
    detalle = describirModificacion(detalle, registro.entidad, documento);
  }
  if (registro.entidad === "ConfiguracionClase") {
    detalle = detalle.replace("Duración general:", "Duración general de las clases:");
  }
  if (registro.entidad === "HorarioClase") {
    detalle = detalle.replace(/\b\d{4}-\d{2}-\d{2}\b/g, fechaLegible);
  }
  if (registro.entidad === "Usuario") {
    detalle = detalle.replace(
      / con rol (cliente|profesional|recepcion|admin)/,
      (_, rol) => ` (rol: ${ROLES[rol]})`
    );
    const registroCliente = detalle.match(/^Registro de cliente vinculado a ([a-f\d]{24})$/i);
    if (registroCliente) {
      const usuario = documento;
      const persona = nombrePersona(usuario?.cliente);
      return persona
        ? `Se registró al cliente ${persona} con el usuario ${usuario.usuario}.`
        : "Se registró una nueva cuenta de cliente.";
    }
  }
  if (!detalle) {
    if (registro.accion === "LOGIN") return "El usuario inició sesión.";
    if (registro.accion === "LOGOUT") return "El usuario cerró sesión.";
    if (registro.accion === "SESION_REVOCADA") return "La sesión dejó de ser válida.";
    if (registro.accion === "CHAT_SIN_OPERADOR") return "No había operadores disponibles para atender la consulta.";
    if (registro.entidad) {
      return `${ACCIONES[registro.accion] || "Operación"} sobre ${ENTIDADES[registro.entidad] || registro.entidad}.`;
    }
  }
  return detalle;
};

const obtenerAuditoria = async (req, res) => {
  const { accion, usuario } = req.query;
  const filtro = {};

  if (accion) filtro.accion = String(accion);
  if (usuario) filtro.usuarioNombre = String(usuario).trim().toLowerCase();

  const registros = await Auditoria.find(filtro).sort({ createdAt: -1 }).limit(100);
  const idsClienteLegado = registros
    .filter((registro) => registro.entidad === "ReservaClase")
    .map((registro) => registro.detalle?.match(/cliente ([a-f\d]{24})/i)?.[1])
    .filter(esObjectId);
  const [
    clientes,
    profesionales,
    usuarios,
    salas,
    horarios,
    chats,
    reservas,
    clientesLegado,
  ] = await Promise.all([
    buscarPorIds(Cliente, idsDe(registros, "Cliente")),
    buscarPorIds(Profesional, idsDe(registros, "Profesional")),
    buscarPorIds(Usuario, idsDe(registros, "Usuario"), [
      { path: "cliente", select: "nombre apellido" },
    ]),
    buscarPorIds(Sala, idsDe(registros, "Sala")),
    buscarPorIds(HorarioClase, idsDe(registros, "HorarioClase"), [
      { path: "profesional", select: "nombre apellido" },
    ]),
    buscarPorIds(Chat, idsDe(registros, "Chat"), [
      { path: "solicitante", select: "usuario nombre" },
      { path: "admin", select: "usuario nombre" },
    ]),
    buscarPorIds(ReservaClase, idsDe(registros, "ReservaClase"), [
      { path: "cliente", select: "nombre apellido" },
      { path: "clase", select: "tipo fecha horaInicio" },
    ]),
    buscarPorIds(Cliente, [...new Set(idsClienteLegado)]),
  ]);
  const documentos = new Map([
    ["Cliente", new Map(clientes.map((documento) => [String(documento._id), documento]))],
    ["Profesional", new Map(profesionales.map((documento) => [String(documento._id), documento]))],
    ["Usuario", new Map(usuarios.map((documento) => [String(documento._id), documento]))],
    ["Sala", new Map(salas.map((documento) => [String(documento._id), documento]))],
    ["HorarioClase", new Map(horarios.map((documento) => [String(documento._id), documento]))],
  ]);
  const datos = {
    documentos,
    reservas: new Map(reservas.map((reserva) => [String(reserva._id), reserva])),
    chats: new Map(chats.map((chat) => [String(chat._id), chat])),
    clientes: new Map(
      clientesLegado.map((cliente) => [String(cliente._id).toLowerCase(), cliente])
    ),
  };
  res.json(
    registros.map((registro) => {
      const datosRegistro = registro.toJSON();
      datosRegistro.detalle = describirEvento(registro, datos);
      return datosRegistro;
    })
  );
};

module.exports = {
  obtenerAuditoria,
  ACCIONES,
  ENTIDADES,
  traducirCampos,
  describirReserva,
  describirAccesoDenegado,
  describirChat,
  describirModificacion,
  describirEvento,
};
