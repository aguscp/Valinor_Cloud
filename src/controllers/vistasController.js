const { ROLES } = require("../config/roles");
const { ACCIONES } = require("../models/Auditoria");

const mostrarLogin = (req, res) => {
  if (req.usuario) return res.redirect(req.usuario.rol === "cliente" ? "/clases" : "/");
  res.render("login");
};

const mostrarRegistro = (req, res) => {
  if (req.usuario) return res.redirect(req.usuario.rol === "cliente" ? "/clases" : "/");
  res.render("registro");
};

const mostrarPanel = (req, res) => {
  if (req.usuario.rol === "cliente") return res.redirect("/clases");
  res.render("home");
};

const mostrarClientes = (req, res) => res.render("clientes/index");

const mostrarProfesionales = (req, res) => {
  if (req.usuario.rol === "cliente") return res.redirect("/turnos");
  res.render("profesionales/index");
};

const mostrarTurnos = (req, res) => res.render("turnos/index");

const mostrarClases = (req, res) => res.render("clases/index");

const mostrarPerfilCliente = (req, res) => {
  if (req.usuario.rol !== "cliente") return res.redirect("/");
  res.render("mi-perfil");
};

const mostrarHorariosDocente = (req, res) => {
  if (req.usuario.rol !== "profesional") return res.redirect("/");
  res.render("clases/horarios");
};

const mostrarSalas = (req, res) => res.render("salas/index");

const mostrarUsuarios = (req, res) => res.render("usuarios/index", { roles: ROLES });

const mostrarAuditoria = (req, res) => res.render("auditoria/index", { acciones: ACCIONES });

module.exports = {
  mostrarLogin,
  mostrarRegistro,
  mostrarPanel,
  mostrarClientes,
  mostrarProfesionales,
  mostrarTurnos,
  mostrarClases,
  mostrarPerfilCliente,
  mostrarHorariosDocente,
  mostrarSalas,
  mostrarUsuarios,
  mostrarAuditoria,
};
