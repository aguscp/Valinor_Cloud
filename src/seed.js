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

const HORARIOS_DE_PRUEBA = [
  { tipo: "Pilates Reformer", horaInicio: "09:00", sala: 0, profesional: 0, reservasPorOcurrencia: [15, 6] },
  { tipo: "Yoga", horaInicio: "10:00", sala: 1, profesional: 1, reservasPorOcurrencia: [8, 10] },
  { tipo: "Pilates Mat", horaInicio: "11:00", sala: 2, profesional: 2, reservasPorOcurrencia: [5, 9] },
  { tipo: "Yoga", horaInicio: "14:00", sala: 1, profesional: 1, diaSemana: 2, reservasPorOcurrencia: [6, 8] },
  { tipo: "Pilates Reformer", horaInicio: "14:00", sala: 0, profesional: 0, diaSemana: 3, reservasPorOcurrencia: [5, 7] },
  { tipo: "Yoga", horaInicio: "14:00", sala: 1, profesional: 1, diaSemana: 4, reservasPorOcurrencia: [9, 6] },
  { tipo: "Pilates Mat", horaInicio: "14:00", sala: 2, profesional: 2, diaSemana: 5, reservasPorOcurrencia: [7, 10] },
];

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

const fechaDeInicio = (horaInicio, ahora) => {
  const hoy = `${ahora.year}-${ahora.month}-${ahora.day}`;
  const horaActual = `${ahora.hour}:${ahora.minute}`;
  return horaInicio > horaActual ? hoy : sumarDias(hoy, 1);
};

const fechaDelProximoDia = (diaSemana, horaInicio, ahora) => {
  const hoy = `${ahora.year}-${ahora.month}-${ahora.day}`;
  const diaActual = new Date(`${hoy}T12:00:00Z`).getUTCDay();
  let diasHasta = (diaSemana - diaActual + 7) % 7;
  const horaActual = `${ahora.hour}:${ahora.minute}`;
  if (diasHasta === 0 && horaInicio <= horaActual) diasHasta = 7;
  return sumarDias(hoy, diasHasta);
};

const sembrar = async () => {
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
      comienzaDesde:
        clase.diaSemana === undefined
          ? fechaDeInicio(clase.horaInicio, ahora)
          : fechaDelProximoDia(clase.diaSemana, clase.horaInicio, ahora),
      repetirSemanas: 2,
      sala: salas[clase.sala]._id,
      profesional: profesionales[clase.profesional]._id,
      activo: true,
    }))
  );
  await generarClasesFuturas();

  let totalReservas = 0;
  for (const [indiceHorario, horario] of horarios.entries()) {
    const ocurrencias = await ClaseProgramada.find({ horario: horario._id }).sort({ fecha: 1 });
    const cantidades = HORARIOS_DE_PRUEBA[indiceHorario].reservasPorOcurrencia;
    if (ocurrencias.length !== cantidades.length) {
      throw new Error(
        `Se esperaban ${cantidades.length} ocurrencias para ${horario.tipo}, ` +
          `pero se generaron ${ocurrencias.length}.`
      );
    }
    const diaEsperado = HORARIOS_DE_PRUEBA[indiceHorario].diaSemana;
    if (
      diaEsperado !== undefined &&
      ocurrencias.some(
        ({ fecha }) => new Date(`${fecha}T12:00:00Z`).getUTCDay() !== diaEsperado
      )
    ) {
      throw new Error(`Las clases de ${horario.tipo} no quedaron en el día semanal esperado.`);
    }

    for (const [indiceOcurrencia, clase] of ocurrencias.entries()) {
      const cantidad = cantidades[indiceOcurrencia];
      if (cantidad > clase.capacidad || cantidad > clientes.length) {
        throw new Error(`La cantidad de reservas de ${clase.tipo} supera su capacidad o los clientes disponibles.`);
      }

      await ReservaClase.insertMany(
        clientes.slice(0, cantidad).map((cliente) => ({
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
      `${salas.length} salas y ${HORARIOS_DE_PRUEBA.length} clases repetidas por 2 semanas ` +
      `(${HORARIOS_DE_PRUEBA.length * 2} ocurrencias y ${totalReservas} reservas de prueba).`
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
  fechaDeInicio,
  fechaDelProximoDia,
};
