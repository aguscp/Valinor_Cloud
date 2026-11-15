require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");

const conectarDB = require("./config/db");
const Cliente = require("./models/Cliente");
const Profesional = require("./models/Profesional");
const Sala = require("./models/Sala");
const ConfiguracionClase = require("./models/ConfiguracionClase");
const HorarioClase = require("./models/HorarioClase");
const ClaseProgramada = require("./models/ClaseProgramada");
const ReservaClase = require("./models/ReservaClase");
const Usuario = require("./models/Usuario");
const Auditoria = require("./models/Auditoria");
const Chat = require("./models/Chat");
const { generarClasesFuturas } = require("./services/clasesService");

const CLIENTES = [
  { nombre: "Juan", apellido: "Pérez", dni: "28456789", telefono: "1145678901", email: "juan.perez@example.com" },
  { nombre: "María", apellido: "González", dni: "31234567", telefono: "1156789012", email: "maria.gonzalez@example.com" },
  { nombre: "Pedro", apellido: "Rodríguez", dni: "25678901", telefono: "1167890123", email: "pedro.rodriguez@example.com" },
  { nombre: "Ana", apellido: "Martínez", dni: "33987654", telefono: "1178901234" },
  { nombre: "Luis", apellido: "Fernández", dni: "22345678", telefono: "1189012345", email: "luis.fernandez@example.com" },
  { nombre: "Sofía", apellido: "López", dni: "35678901", telefono: "1190123456", email: "sofia.lopez@example.com" },
  { nombre: "Carlos", apellido: "Sánchez", dni: "29876543", telefono: "1101234567", email: "carlos.sanchez@example.com" },
  { nombre: "Lucía", apellido: "Romero", dni: "36789012", telefono: "1112345678", email: "lucia.romero@example.com" },
  { nombre: "Micaela", apellido: "Torres", dni: "30123456", telefono: "1123456701", email: "micaela.torres@example.com" },
  { nombre: "Joaquín", apellido: "Ruiz", dni: "31876543", telefono: "1123456702", email: "joaquin.ruiz@example.com" },
  { nombre: "Florencia", apellido: "Díaz", dni: "32765432", telefono: "1123456703", email: "florencia.diaz@example.com" },
  { nombre: "Tomás", apellido: "Álvarez", dni: "33456789", telefono: "1123456704", email: "tomas.alvarez@example.com" },
  { nombre: "Julieta", apellido: "Benítez", dni: "34567890", telefono: "1123456705", email: "julieta.benitez@example.com" },
  { nombre: "Mateo", apellido: "Molina", dni: "35987654", telefono: "1123456706", email: "mateo.molina@example.com" },
  { nombre: "Camila", apellido: "Herrera", dni: "37123456", telefono: "1123456707", email: "camila.herrera@example.com" },
  { nombre: "Bruno", apellido: "Castro", dni: "38234567", telefono: "1123456708", email: "bruno.castro@example.com" },
  { nombre: "Agustina", apellido: "Ortiz", dni: "29345678", telefono: "1123456709", email: "agustina.ortiz@example.com" },
  { nombre: "Franco", apellido: "Medina", dni: "30456789", telefono: "1123456710", email: "franco.medina@example.com" },
  { nombre: "Valentina", apellido: "Suárez", dni: "31567890", telefono: "1123456711", email: "valentina.suarez@example.com" },
  { nombre: "Nicolás", apellido: "Castillo", dni: "32678901", telefono: "1123456712", email: "nicolas.castillo@example.com" },
];

const PROFESIONALES = [
  { nombre: "Camila", apellido: "Ferreyra", especialidad: "Pilates Reformer", matricula: "PIL-1021" },
  { nombre: "Martín", apellido: "Acosta", especialidad: "Yoga", matricula: "YOG-2045" },
  { nombre: "Valeria", apellido: "Quiroga", especialidad: "Pilates Mat", matricula: "PIL-3310" },
];

const SALAS_DE_PRUEBA = [
  { nombre: "Sala 1", capacidad: 15 },
  { nombre: "Sala 2", capacidad: 15 },
  { nombre: "Sala 3", capacidad: 20 },
];

const CLASES_POR_DIA = [
  { tipo: "Pilates Reformer", horaInicio: "09:00", sala: 0, profesional: 0 },
  { tipo: "Yoga", horaInicio: "13:00", sala: 1, profesional: 1 },
  { tipo: "Pilates Mat", horaInicio: "17:00", sala: 2, profesional: 2 },
];
const SEMANAS_DE_PRUEBA = 3;

const HORARIOS_DE_PRUEBA = Array.from({ length: 7 }, (_, diaSemana) =>
  CLASES_POR_DIA.map((clase, indiceClase) => ({
    ...clase,
    diaSemana,
    repetirSemanas: SEMANAS_DE_PRUEBA,
    reservasPorOcurrencia: Array.from(
      { length: SEMANAS_DE_PRUEBA },
      (_, semana) =>
        semana >= 2
          ? 0
          : indiceClase === 0
            ? 1
            : 2
    ),
  }))
).flat();

const validarHorariosDePrueba = (horarios) => {
  const cantidadPorDia = Array(7).fill(0);
  const reservasPorSemana = Array(SEMANAS_DE_PRUEBA).fill(0);
  for (const horario of horarios) {
    if (!Number.isInteger(horario.diaSemana) || horario.diaSemana < 0 || horario.diaSemana > 6) {
      throw new Error(`El horario ${horario.tipo} tiene un día de semana inválido.`);
    }
    cantidadPorDia[horario.diaSemana] += 1;
    if (horario.repetirSemanas !== SEMANAS_DE_PRUEBA) {
      throw new Error(`El horario ${horario.tipo} debe repetirse durante ${SEMANAS_DE_PRUEBA} semanas.`);
    }
    if (horario.reservasPorOcurrencia.length !== SEMANAS_DE_PRUEBA) {
      throw new Error(
        `El horario ${horario.tipo} no tiene reservas de prueba para las ${SEMANAS_DE_PRUEBA} semanas.`
      );
    }
    if (horario.reservasPorOcurrencia.slice(2).some((cantidad) => cantidad !== 0)) {
      throw new Error(`El horario ${horario.tipo} no debe tener reservas a partir de la tercera semana.`);
    }
    horario.reservasPorOcurrencia.forEach((cantidad, semana) => {
      if (cantidad < 0 || cantidad > 2) {
        throw new Error(`La clase ${horario.tipo} debe tener como máximo 2 reservas.`);
      }
      reservasPorSemana[semana] += cantidad;
    });
  }
  if (reservasPorSemana.slice(0, 2).some((cantidad) => cantidad > 35)) {
    throw new Error("Las reservas de una semana superan el límite de 2 por cliente.");
  }
  const diaIncompleto = cantidadPorDia.findIndex((cantidad) => cantidad !== 3);
  if (diaIncompleto !== -1) {
    throw new Error(`El día ${diaIncompleto} debe tener exactamente 3 clases de prueba.`);
  }
  if (reservasPorSemana.some((cantidad) => cantidad > CLIENTES.length * 2)) {
    throw new Error("Las reservas de una semana superan el límite de 2 por cliente.");
  }
};

const elegirClientesParaClase = ({
  clientes,
  cantidad,
  fecha,
  semana,
  indiceInicial,
  clientesReservadosPorFecha,
  reservasPorClientePorSemana,
}) => {
  const clientesDelDia = clientesReservadosPorFecha.get(fecha) || new Set();
  const reservasSemanales =
    reservasPorClientePorSemana.get(semana) || new Map();
  const elegidos = [];
  for (let desplazamiento = 0; desplazamiento < clientes.length; desplazamiento += 1) {
    const cliente = clientes[(indiceInicial + desplazamiento) % clientes.length];
    const id = String(cliente._id);
    if (clientesDelDia.has(id) || (reservasSemanales.get(id) || 0) >= 2) continue;
    elegidos.push(cliente);
    if (elegidos.length === cantidad) break;
  }
  if (elegidos.length !== cantidad) {
    throw new Error(
      `No hay suficientes clientes que cumplan los límites para reservar el ${fecha}.`
    );
  }
  for (const cliente of elegidos) {
    const id = String(cliente._id);
    clientesDelDia.add(id);
    reservasSemanales.set(id, (reservasSemanales.get(id) || 0) + 1);
  }
  clientesReservadosPorFecha.set(fecha, clientesDelDia);
  reservasPorClientePorSemana.set(semana, reservasSemanales);
  return elegidos;
};

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

const sumarDias = (fecha, dias) => {
  const resultado = new Date(`${fecha}T12:00:00Z`);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado.toISOString().slice(0, 10);
};

const inicioDeSemana = (fecha) => {
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  return sumarDias(fecha, -((dia + 6) % 7));
};

const fechaDeInicioParaDia = (diaSemana, ahora) => {
  const hoy = `${ahora.year}-${ahora.month}-${ahora.day}`;
  const diaActual = new Date(`${hoy}T12:00:00Z`).getUTCDay();
  const diasHasta = (diaSemana - diaActual + 7) % 7;
  return sumarDias(hoy, diasHasta);
};

const horaFin = (horaInicio, duracionMinutos) => {
  const [horas, minutos] = horaInicio.split(":").map(Number);
  const totalMinutos = horas * 60 + minutos + duracionMinutos;
  return `${String(Math.floor(totalMinutos / 60)).padStart(2, "0")}:${String(totalMinutos % 60).padStart(2, "0")}`;
};

const asegurarClasesDeHoy = async (horarios, hoy, duracionMinutos) => {
  for (const horario of horarios.filter(({ comienzaDesde }) => comienzaDesde === hoy)) {
    const sala = await Sala.findById(horario.sala);
    if (!sala) throw new Error(`No se encontró la sala del horario ${horario.tipo}.`);
    await ClaseProgramada.updateOne(
      { horario: horario._id, fecha: hoy },
      {
        $setOnInsert: {
          horario: horario._id,
          fecha: hoy,
          tipo: horario.tipo,
          profesional: horario.profesional,
          sala: sala._id,
          horaInicio: horario.horaInicio,
          horaFin: horaFin(horario.horaInicio, duracionMinutos),
          capacidad: sala.capacidad,
          reservas: 0,
          activa: true,
        },
      },
      { upsert: true }
    );
  }
};

const sembrar = async () => {
  validarHorariosDePrueba(HORARIOS_DE_PRUEBA);
  await conectarDB();

  await Promise.all([
    Cliente.deleteMany({}),
    Profesional.deleteMany({}),
    ReservaClase.deleteMany({}),
    ClaseProgramada.deleteMany({}),
    HorarioClase.deleteMany({}),
    Sala.deleteMany({}),
    ConfiguracionClase.deleteMany({}),
    Usuario.deleteMany({}),
    Auditoria.deleteMany({}),
    Chat.deleteMany({}),
  ]);
  await Promise.all([
    Cliente.syncIndexes(),
    Profesional.syncIndexes(),
    Usuario.syncIndexes(),
    Chat.syncIndexes(),
  ]);

  const clientes = await Cliente.insertMany(CLIENTES);
  const profesionales = await Profesional.insertMany(PROFESIONALES);
  const salas = await Sala.insertMany(SALAS_DE_PRUEBA);
  await ConfiguracionClase.create({ clave: "general", duracionMinutos: 60 });

  const usuariosPersonal = [
    { usuario: "admin", password: "admin123", nombre: "Administrador", rol: "admin" },
    // Segundo admin para probar la asignación y reasignación de chats entre operadores.
    { usuario: "admin2", password: "admin123", nombre: "Administradora 2", rol: "admin" },
    { usuario: "recepcion", password: "recepcion123", nombre: "Recepcionista", rol: "recepcion" },
    {
      usuario: "profesional1",
      password: "prof1234",
      nombre: "Profesional 1",
      rol: "profesional",
      profesional: profesionales[0]._id,
    },
    {
      usuario: "profesional2",
      password: "prof5678",
      nombre: "Profesional 2",
      rol: "profesional",
      profesional: profesionales[1]._id,
    },
    {
      usuario: "profesional3",
      password: "prof9012",
      nombre: "Profesional 3",
      rol: "profesional",
      profesional: profesionales[2]._id,
    },
  ];
  const usuariosClientes = clientes.map((cliente, indice) => ({
    usuario: `cliente${indice + 1}`,
    password: "cliente123",
    nombre: `${cliente.nombre} ${cliente.apellido}`,
    rol: "cliente",
    cliente: cliente._id,
  }));
  await Usuario.create([...usuariosPersonal, ...usuariosClientes]);

  const ahora = horaActualEnArgentina();
  const horarios = await HorarioClase.insertMany(
    HORARIOS_DE_PRUEBA.map((clase) => ({
      tipo: clase.tipo,
      horaInicio: clase.horaInicio,
      comienzaDesde: fechaDeInicioParaDia(clase.diaSemana, ahora),
      repetirSemanas: clase.repetirSemanas,
      sala: salas[clase.sala]._id,
      profesional: profesionales[clase.profesional]._id,
      activo: true,
    }))
  );
  await generarClasesFuturas();
  const hoy = `${ahora.year}-${ahora.month}-${ahora.day}`;
  await asegurarClasesDeHoy(horarios, hoy, 60);

  let totalReservas = 0;
  let indiceCliente = 0;
  const clientesReservadosPorFecha = new Map();
  const reservasPorClientePorSemana = new Map();
  for (const [indiceHorario, horario] of horarios.entries()) {
    const ocurrencias = await ClaseProgramada.find({ horario: horario._id }).sort({ fecha: 1 });
    const cantidades = HORARIOS_DE_PRUEBA[indiceHorario].reservasPorOcurrencia;
    if (ocurrencias.length !== cantidades.length) {
      throw new Error(
        `Se esperaban ${cantidades.length} ocurrencias para ${horario.tipo}, ` +
          `pero se generaron ${ocurrencias.length}.`
      );
    }
    const horarioDePrueba = HORARIOS_DE_PRUEBA[indiceHorario];
    if (ocurrencias.length !== SEMANAS_DE_PRUEBA) {
      throw new Error(
        `El horario ${horario.tipo} no generó sus ${SEMANAS_DE_PRUEBA} clases semanales.`
      );
    }
    if (
      ocurrencias.some(
        ({ fecha }, semana) =>
          new Date(`${fecha}T12:00:00Z`).getUTCDay() !== horarioDePrueba.diaSemana ||
          fecha !== sumarDias(horario.comienzaDesde, semana * 7)
      )
    ) {
      throw new Error(`Las clases de ${horario.tipo} no quedaron en el día semanal esperado.`);
    }

    for (const [indiceOcurrencia, clase] of ocurrencias.entries()) {
      const cantidad = cantidades[indiceOcurrencia];
      if (cantidad === 0) {
        const reservasExistentes = await ReservaClase.exists({ clase: clase._id });
        if (clase.reservas !== 0 || reservasExistentes) {
          throw new Error(`La clase ${clase.tipo} del ${clase.fecha} debe quedar sin reservas.`);
        }
        continue;
      }
      if (cantidad > clase.capacidad || cantidad > clientes.length) {
        throw new Error(`La cantidad de reservas de ${clase.tipo} supera su capacidad o los clientes disponibles.`);
      }

      const clientesElegidos = elegirClientesParaClase({
        clientes,
        cantidad,
        fecha: clase.fecha,
        semana: inicioDeSemana(clase.fecha),
        indiceInicial: indiceCliente,
        clientesReservadosPorFecha,
        reservasPorClientePorSemana,
      });
      indiceCliente = (indiceCliente + cantidad) % clientes.length;

      await ReservaClase.insertMany(
        clientesElegidos.map((cliente) => ({
          clase: clase._id,
          cliente: cliente._id,
        }))
      );
      await ClaseProgramada.updateOne({ _id: clase._id }, { $set: { reservas: cantidad } });
      totalReservas += cantidad;
    }
  }

  console.log(
    `Datos cargados: ${clientes.length} clientes, ${profesionales.length} profesores, ` +
      `${salas.length} salas y ${HORARIOS_DE_PRUEBA.length} horarios (3 por día durante ` +
      `${SEMANAS_DE_PRUEBA} semanas; ${HORARIOS_DE_PRUEBA.length * SEMANAS_DE_PRUEBA} clases y ` +
      `${totalReservas} reservas de prueba).`
  );
  console.log(
    `Usuarios de prueba: admin/admin123, recepcion/recepcion123, profesional1/prof1234, ` +
      `profesional2/prof5678, profesional3/prof9012 y cliente1–cliente${clientes.length}/cliente123.`
  );
};

if (require.main === module) {
  sembrar()
    .catch((error) => {
      console.error("Error al cargar los datos:", error.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = {
  CLIENTES,
  PROFESIONALES,
  SALAS_DE_PRUEBA,
  HORARIOS_DE_PRUEBA,
  SEMANAS_DE_PRUEBA,
  fechaDeInicioParaDia,
  inicioDeSemana,
  validarHorariosDePrueba,
  elegirClientesParaClase,
};
