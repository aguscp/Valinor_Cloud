const express = require("express");
const { requiereLogin, requierePermiso } = require("../../middlewares/auth");
const {
  obtenerSalas,
  crearSala,
  actualizarSala,
} = require("../../controllers/clasesController");

const router = express.Router();

router.use(requiereLogin, requierePermiso("salas:manage"));

router.get("/", obtenerSalas);
router.post("/", crearSala);
router.put("/:id", actualizarSala);

module.exports = router;
