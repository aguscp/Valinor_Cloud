const ROLES = ["cliente", "profesional", "recepcion", "admin"];

const cliente = [
  "profesionales:read",
  "turnos:read",
  "chat:usar",
  "clases:read",
  "clases:reservar",
  "clases:cancelar",
];
const profesional = [
  "clientes:read",
  "profesionales:read",
  "turnos:read",
  "turnos:update",
  "chat:usar",
  "clases:gestionar",
];

const recepcion = [
  ...profesional.filter((permiso) => permiso !== "clases:gestionar"),
  "clientes:create",
  "clientes:update",
  "clientes:delete",
  "profesionales:create",
  "profesionales:update",
  "profesionales:delete",
  "turnos:create",
  "turnos:delete",
];

const admin = [
  ...recepcion,
  "usuarios:create",
  "usuarios:read",
  "usuarios:update",
  "usuarios:delete",
  "auditoria:read",
  "chat:moderar",
  "salas:manage",
  "clases:configurar",
];

const PERMISOS_POR_ROL = { cliente, profesional, recepcion, admin };

const permisosDe = (rol) => PERMISOS_POR_ROL[rol] || [];

const tienePermiso = (rol, permiso) => permisosDe(rol).includes(permiso);

module.exports = { ROLES, PERMISOS_POR_ROL, permisosDe, tienePermiso };
