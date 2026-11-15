require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const http = require("http");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");

const conectarDB = require("./config/db");
const passport = require("./config/passport");
const logger = require("./middlewares/logger");
const { notFound, errorHandler } = require("./middlewares/errores");
const { iniciarSocket } = require("./socket");
const { recuperarTimeouts } = require("./services/chatService");
const ReservaClase = require("./models/ReservaClase");

const authRoutes = require("./routes/api/authRoutes");
const clientesRoutes = require("./routes/api/clientesRoutes");
const profesionalesRoutes = require("./routes/api/profesionalesRoutes");
const usuariosRoutes = require("./routes/api/usuariosRoutes");
const auditoriaRoutes = require("./routes/api/auditoriaRoutes");
const chatRoutes = require("./routes/api/chatRoutes");
const clasesRoutes = require("./routes/api/clasesRoutes");
const salasRoutes = require("./routes/api/salasRoutes");
const vistasRoutes = require("./routes/vistasRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

const actualizarIndiceReservas = async () => {
  const nombreColeccion = ReservaClase.collection.collectionName;
  const existeColeccion = await mongoose.connection.db
    .listCollections({ name: nombreColeccion }, { nameOnly: true })
    .hasNext();
  if (!existeColeccion) await ReservaClase.createCollection();

  const indices = await ReservaClase.collection.indexes();
  const indiceUnicoAnterior = indices.find(
    (indice) =>
      indice.unique &&
      !indice.partialFilterExpression &&
      Object.keys(indice.key).length === 2 &&
      indice.key.clase === 1 &&
      indice.key.cliente === 1
  );
  if (indiceUnicoAnterior) {
    await ReservaClase.collection.dropIndex(indiceUnicoAnterior.name);
  }
  await ReservaClase.createIndexes();
};

app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(logger);
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

app.use("/api/auth", authRoutes);
app.use("/api/clientes", clientesRoutes);
app.use("/api/profesionales", profesionalesRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/auditoria", auditoriaRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/clases", clasesRoutes);
app.use("/api/salas", salasRoutes);
// Ruta actual para marcar el ítem activo de la sidebar en las vistas.
app.use((req, res, next) => {
  res.locals.rutaActual = req.path;
  next();
});
app.use("/", vistasRoutes);

app.use(notFound);
app.use(errorHandler);

// Express y Socket.io comparten el mismo servidor HTTP (y el mismo puerto).
const servidor = http.createServer(app);
iniciarSocket(servidor);

const iniciar = async () => {
  await conectarDB();
  const migracionReservas = await ReservaClase.updateMany(
    { estado: mongoose.trusted({ $exists: false }) },
    { $set: { estado: "reservada" } }
  );
  if (migracionReservas.modifiedCount) {
    console.log(`Reservas de clases actualizadas: ${migracionReservas.modifiedCount}.`);
  }
  await actualizarIndiceReservas();
  await recuperarTimeouts();
  servidor.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
};

iniciar().catch((error) => {
  console.error("No se pudo iniciar el servidor:", error.message);
  process.exit(1);
});
