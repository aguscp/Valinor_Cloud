const express = require("express");
const { requiereLogin, requierePermiso, usuarioOpcional } = require("../middlewares/auth");
const {
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
} = require("../controllers/vistasController");

const router = express.Router();

router.get("/login", usuarioOpcional, mostrarLogin);
router.get("/registro", usuarioOpcional, mostrarRegistro);

router.use(requiereLogin);

router.get("/", mostrarPanel);
router.get("/clientes", requierePermiso("clientes:read"), mostrarClientes);
router.get("/profesionales", requierePermiso("profesionales:read"), mostrarProfesionales);
router.get("/turnos", requierePermiso("turnos:read"), mostrarTurnos);
router.get("/clases", requierePermiso("clases:read"), mostrarClases);
router.get("/mi-perfil", mostrarPerfilCliente);
router.get("/mis-clases", requierePermiso("clases:gestionar"), mostrarHorariosDocente);
router.get("/salas", requierePermiso("salas:manage"), mostrarSalas);
router.get("/usuarios", requierePermiso("usuarios:read"), mostrarUsuarios);
router.get("/auditoria", requierePermiso("auditoria:read"), mostrarAuditoria);

module.exports = router;
