const Usuario = require("../models/Usuario");
const Cliente = require("../models/Cliente");
const { permisosDe } = require("../config/roles");
const { tomarCampos, describirCambios } = require("../helpers/campos");
const { registrarAuditoria } = require("../helpers/auditoria");
const { autenticar } = require("../middlewares/auth");
const { firmarToken, enviarTokenEnCookie, borrarCookieToken } = require("../helpers/token");
const { desconectarUsuario } = require("../socket/emisor");

const login = async (req, res) => {
  const { usuario: usuarioIngresado, password } = req.body || {};

  if (!String(usuarioIngresado || "").trim() || !password) {
    return res.status(400).json({ error: "Ingresá usuario y contraseña" });
  }

  const { usuario, info } = await autenticar("local", req, res);

  if (!usuario) {
    await registrarAuditoria(req, "LOGIN_FALLIDO", {
      usuario: info.usuario,
      usuarioNombre: info.usuarioNombre,
      detalle: info.detalle,
    });
    return res.status(info.status || 401).json({ error: info.error || "No se pudo iniciar sesión" });
  }

  const token = firmarToken(usuario);
  enviarTokenEnCookie(res, token);

  await Usuario.updateOne(
    { _id: usuario._id },
    { ultimoAcceso: new Date() },
    { timestamps: false }
  );
  await registrarAuditoria(req, "LOGIN", { usuario, entidad: "Usuario", entidadId: usuario._id });

  res.json({ token, usuario: usuario.usuario, nombre: usuario.nombre, rol: usuario.rol });
};

// Sin sesiones en el servidor: el logout sube tokenVersion para invalidar los
// tokens ya emitidos de este usuario y borra la cookie del navegador.
const logout = async (req, res) => {
  await Usuario.updateOne(
    { _id: req.usuario._id },
    { $inc: { tokenVersion: 1 } },
    { timestamps: false }
  );
  await registrarAuditoria(req, "LOGOUT", { entidad: "Usuario", entidadId: req.usuario._id });
  // Los sockets abiertos (chat) se autenticaron con el token viejo: se cierran.
  desconectarUsuario(req.usuario._id);
  borrarCookieToken(res);
  res.status(204).end();
};

const usuarioActual = (req, res) => {
  const { usuario, nombre, rol, ultimoAcceso } = req.usuario;
  res.json({ usuario, nombre, rol, ultimoAcceso, permisos: permisosDe(rol) });
};

const perfilCliente = async (req, res) => {
  if (req.usuario.rol !== "cliente" || !req.usuario.cliente) {
    return res.status(403).json({ error: "Esta sección es solo para cuentas de clientes" });
  }

  const cliente = await Cliente.findById(req.usuario.cliente);
  if (!cliente) return res.status(404).json({ error: "No se encontró el perfil del cliente" });
  res.json(cliente);
};

const actualizarPerfilCliente = async (req, res) => {
  if (req.usuario.rol !== "cliente" || !req.usuario.cliente) {
    return res.status(403).json({ error: "Esta sección es solo para cuentas de clientes" });
  }

  const cliente = await Cliente.findById(req.usuario.cliente);
  if (!cliente) return res.status(404).json({ error: "No se encontró el perfil del cliente" });

  cliente.set(tomarCampos(req.body, ["nombre", "apellido", "telefono", "email"]));
  const cambios = describirCambios(cliente);
  await cliente.save();

  const nombreActualizado = `${cliente.nombre} ${cliente.apellido}`;
  if (req.usuario.nombre !== nombreActualizado) {
    req.usuario.nombre = nombreActualizado;
    await req.usuario.save();
  }

  await registrarAuditoria(req, "MODIFICAR", {
    entidad: "Cliente",
    entidadId: cliente._id,
    detalle: `Perfil propio - campos: ${cambios}`,
  });
  res.json(cliente);
};

const registrarCliente = async (req, res) => {
  const datos = tomarCampos(req.body, [
    "nombre",
    "apellido",
    "dni",
    "telefono",
    "email",
    "usuario",
    "password",
  ]);
  const cliente = new Cliente(
    tomarCampos(datos, ["nombre", "apellido", "dni", "telefono", "email"])
  );
  const usuario = new Usuario({
    usuario: datos.usuario,
    password: datos.password,
    nombre: `${datos.nombre || ""} ${datos.apellido || ""}`.trim(),
    rol: "cliente",
  });
  usuario.cliente = cliente._id;

  await Promise.all([cliente.validate(), usuario.validate()]);
  await cliente.save();

  try {
    await usuario.save();
  } catch (error) {
    await cliente.deleteOne();
    throw error;
  }

  const token = firmarToken(usuario);
  enviarTokenEnCookie(res, token);
  await Usuario.updateOne(
    { _id: usuario._id },
    { ultimoAcceso: new Date() },
    { timestamps: false }
  );
  await registrarAuditoria(req, "CREAR", {
    usuario,
    entidad: "Usuario",
    entidadId: usuario._id,
    detalle: `Registro de cliente vinculado a ${cliente._id}`,
  });

  res.status(201).json({
    token,
    usuario: usuario.usuario,
    nombre: usuario.nombre,
    rol: usuario.rol,
  });
};

module.exports = {
  login,
  logout,
  usuarioActual,
  perfilCliente,
  actualizarPerfilCliente,
  registrarCliente,
};
