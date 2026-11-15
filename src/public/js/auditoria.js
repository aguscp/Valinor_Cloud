const tablaAuditoria = document.getElementById("tablaAuditoria");
const sinRegistros = document.getElementById("sinRegistros");
const errorAuditoria = document.getElementById("errorAuditoria");
const formFiltros = document.getElementById("formFiltros");

const nombresAcciones = {
  LOGIN: "Inicio de sesión",
  LOGIN_FALLIDO: "Inicio de sesión fallido",
  LOGOUT: "Cierre de sesión",
  CREAR: "Creación",
  MODIFICAR: "Modificación",
  ELIMINAR: "Eliminación",
  CAMBIO_ESTADO: "Cambio de estado",
  ACCESO_DENEGADO: "Acceso denegado",
  SESION_REVOCADA: "Sesión revocada",
  CHAT_SIN_OPERADOR: "Sin operador disponible",
};

const nombresEntidades = {
  ConfiguracionClase: "Configuración de clases",
  HorarioClase: "Horario de clase",
  ClaseProgramada: "Clase",
  ReservaClase: "Reserva de clase",
  Chat: "Consulta por chat",
};

const claseDeAccion = (accion) => {
  if (["ACCESO_DENEGADO", "LOGIN_FALLIDO", "SESION_REVOCADA", "CHAT_SIN_OPERADOR"].includes(accion)) {
    return "etiqueta-peligro";
  }
  if (["LOGIN", "LOGOUT", "Inicio de sesión", "Cierre de sesión"].includes(accion)) return "etiqueta-info";
  return "etiqueta-exito";
};

const nombreAccion = (accion) =>
  nombresAcciones[accion] || accion;

const nombreEntidad = (entidad) => nombresEntidades[entidad] || entidad || "—";

for (const opcion of formFiltros.elements.accion.options) {
  opcion.textContent = opcion.value ? nombreAccion(opcion.value) : "Todas";
}

const cargarAuditoria = async () => {
  const filtros = new URLSearchParams();
  Object.entries(leerFormulario(formFiltros)).forEach(([clave, valor]) => {
    if (valor) filtros.append(clave, valor);
  });

  try {
    const registros = await api(`/api/auditoria?${filtros}`);
    tablaAuditoria.replaceChildren(
      ...registros.map((registro) =>
        crearFila(
          [
            formatearFechaHora(registro.createdAt),
            registro.usuarioNombre,
            crearEtiqueta(nombreAccion(registro.accion), claseDeAccion(registro.accion)),
            nombreEntidad(registro.entidad),
            registro.detalle,
            registro.ip,
          ],
          null
        )
      )
    );
    sinRegistros.hidden = registros.length > 0;
    mostrarError(errorAuditoria, "");
  } catch (error) {
    mostrarError(errorAuditoria, error.message);
  }
};

formFiltros.addEventListener("submit", (evento) => {
  evento.preventDefault();
  cargarAuditoria();
});

cargarAuditoria();
