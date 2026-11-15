const express = require("express");
const { requiereLogin } = require("../../middlewares/auth");
const {
  login,
  logout,
  usuarioActual,
  perfilCliente,
  actualizarPerfilCliente,
  registrarCliente,
} = require("../../controllers/authController");

const router = express.Router();

router.post("/login", login);
router.post("/registro-clientes", registrarCliente);
router.post("/logout", requiereLogin, logout);
router.get("/yo/perfil", requiereLogin, perfilCliente);
router.put("/yo/perfil", requiereLogin, actualizarPerfilCliente);
router.get("/yo", requiereLogin, usuarioActual);

module.exports = router;
