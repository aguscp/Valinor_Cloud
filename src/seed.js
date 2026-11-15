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

const CLIENTES = [
  { nombre: "Juan", apellido: "Pérez", dni: "28456789", telefono: "1145678901", email: "juan.perez@example.com" },
  { nombre: "María", apellido: "González", dni: "31234567", telefono: "1156789012", email: "maria.gonzalez@example.com" },
  { nombre: "Pedro", apellido: "Rodríguez", dni: "25678901", telefono: "1167890123", email: "pedro.rodriguez@example.com" },
  { nombre: "Ana", apellido: "Martínez", dni: "33987654", telefono: "1178901234" },
  { nombre: "Luis", apellido: "Fernández", dni: "22345678", telefono: "1189012345", email: "luis.fernandez@example.com" },
  { nombre: "Sofía", apellido: "López", dni: "35678901", telefono: "1190123456", email: "sofia.lopez@example.com" },
  { nombre: "Carlos", apellido: "Sánchez", dni: "29876543", telefono: "1101234567", email: "carlos.sanchez@example.com" },
  { nombre: "Lucía", apellido: "Romero", dni: "36789012", telefono: "1112345678", email: "lucia.romero@example.com" },
];

const PROFESIONALES = [
  { nombre: "Camila", apellido: "Ferreyra", especialidad: "Pilates Reformer", matricula: "PIL-1021" },
  { nombre: "Martín", apellido: "Acosta", especialidad: "Yoga", matricula: "YOG-2045" },
  { nombre: "Valeria", apellido: "Quiroga", especialidad: "Masajes descontracturantes", matricula: "MAS-3310" },
];

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

  await Usuario.create({
    usuario: "admin",
    password: "admin123",
    nombre: "Administrador",
    rol: "admin",
  });

  await Usuario.create([
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
  ]);

  console.log(
    `Datos cargados: ${clientes.length} clientes, ${profesionales.length} profesionales, ` +
      `5 usuarios.`
  );
};

sembrar()
  .catch((error) => {
    console.error("Error al cargar los datos:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
