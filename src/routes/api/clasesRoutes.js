const express = require("express");
const { requiereLogin, requierePermiso } = require("../../middlewares/auth");
const {
  obtenerConfiguracion,
  actualizarConfiguracion,
  obtenerHorarios,
  obtenerSalasDisponibles,
  crearHorario,
  actualizarHorario,
  eliminarHorario,
  obtenerClasesDisponiblesCliente,
  obtenerClasesParaReserva,
  reservarClase,
  reservarClaseParaCliente,
  obtenerMisReservas,
  obtenerReservas,
  cancelarReservaCliente,
  cancelarReservaPersonal,
  marcarAsistencia,
  eliminarReservaCancelada,
} = require("../../controllers/clasesController");

const router = express.Router();

router.use(requiereLogin);

router.get("/configuracion", requierePermiso("clases:configurar"), obtenerConfiguracion);
router.put("/configuracion", requierePermiso("clases:configurar"), actualizarConfiguracion);
router.get("/horarios/salas-disponibles", requierePermiso("clases:gestionar"), obtenerSalasDisponibles);
router.get("/horarios", requierePermiso("clases:gestionar"), obtenerHorarios);
router.post("/horarios", requierePermiso("clases:gestionar"), crearHorario);
router.put("/horarios/:id", requierePermiso("clases:gestionar"), actualizarHorario);
router.delete("/horarios/:id", requierePermiso("clases:gestionar"), eliminarHorario);
router.get("/para-reservar", requierePermiso("turnos:create"), obtenerClasesParaReserva);
router.get("/disponibles", requierePermiso("clases:read"), obtenerClasesDisponiblesCliente);
router.get("/mis-reservas", requierePermiso("clases:reservar"), obtenerMisReservas);
router.get("/reservas", requierePermiso("turnos:read"), obtenerReservas);
router.patch(
  "/reservas/:id/cancelar",
  requierePermiso("clases:cancelar"),
  cancelarReservaCliente
);
router.patch(
  "/reservas/:id/cancelar-personal",
  requierePermiso("turnos:update"),
  cancelarReservaPersonal
);
router.patch(
  "/reservas/:id/asistencia",
  requierePermiso("turnos:update"),
  marcarAsistencia
);
router.delete(
  "/reservas/:id",
  requierePermiso("turnos:delete"),
  eliminarReservaCancelada
);
router.post("/:id/reservas", requierePermiso("clases:reservar"), reservarClase);
router.post("/:id/reservas-para-cliente", requierePermiso("turnos:create"), reservarClaseParaCliente);

module.exports = router;
