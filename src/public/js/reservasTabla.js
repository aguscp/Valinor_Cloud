const fechaHoraActualArgentina = () => {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value])
  );
  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}`;
};

const cambiarEstadoReserva = async (reserva, accion) => {
  const clase = reserva.clase;
  const mensaje =
    accion === "asistencia"
      ? `¿Marcar como asistida la reserva de ${nombreCompleto(reserva.cliente)} para ${clase.tipo} el ${clase.fecha} a las ${clase.horaInicio}?`
      : `¿Cancelar la reserva de ${nombreCompleto(reserva.cliente)} para ${clase.tipo} el ${clase.fecha} a las ${clase.horaInicio}? El lugar quedará disponible y se conservará en el historial.`;
  const confirmado = await confirmar({
    titulo: accion === "asistencia" ? "Marcar asistencia" : "Cancelar reserva",
    mensaje,
    textoConfirmar: accion === "asistencia" ? "Marcar asistencia" : "Cancelar reserva",
    variante: accion === "asistencia" ? "exito" : "peligro",
  });
  if (!confirmado) return false;

  const ruta =
    accion === "asistencia"
      ? `/api/clases/reservas/${reserva._id}/asistencia`
      : `/api/clases/reservas/${reserva._id}/${
          rolActual === "cliente" ? "cancelar" : "cancelar-personal"
        }`;
  await api(ruta, { method: "PATCH" });
  return true;
};

const eliminarReserva = async (reserva) => {
  const clase = reserva.clase;
  const confirmado = await confirmar({
    titulo: "Eliminar reserva cancelada",
    mensaje: `¿Eliminar definitivamente la reserva de ${nombreCompleto(reserva.cliente)} para ${clase?.tipo || "la clase"}? Esta acción no se puede deshacer.`,
    textoConfirmar: "Eliminar",
    variante: "peligro",
  });
  if (!confirmado) return false;
  await api(`/api/clases/reservas/${reserva._id}`, { method: "DELETE" });
  return true;
};

const crearFilaReservaClase = (reserva, alTerminar, alFallar) => {
  const clase = reserva.clase || {};
  const ejecutar = (operacion) => async () => {
    try {
      if (await operacion()) await alTerminar();
    } catch (error) {
      alFallar(error.message);
    }
  };
  const acciones = [];
  if (reserva.estado === "reservada" && clase._id) {
    if (rolActual === "cliente" && puede("clases:cancelar")) {
      const inicioClase = `${clase.fecha}T${clase.horaInicio}`;
      if (clase.fecha && clase.horaInicio && inicioClase > fechaHoraActualArgentina()) {
        acciones.push(
          crearBoton(
            "Cancelar",
            "btn-cancelar",
            ejecutar(() => cambiarEstadoReserva(reserva, "cancelacion"))
          )
        );
      }
    } else if (["admin", "recepcion"].includes(rolActual) && puede("turnos:update")) {
      acciones.push(
        crearBoton(
          "Cancelar",
          "btn-cancelar",
          ejecutar(() => cambiarEstadoReserva(reserva, "cancelacion"))
        )
      );
    }
    if (["admin", "profesional"].includes(rolActual) && puede("turnos:update")) {
      acciones.push(
        crearBoton(
          "Asistió",
          "btn-atender",
          ejecutar(() => cambiarEstadoReserva(reserva, "asistencia"))
        )
      );
    }
  }
  if (reserva.estado === "cancelada" && puede("turnos:delete")) {
    acciones.push(crearBoton("Eliminar", "btn-danger", ejecutar(() => eliminarReserva(reserva))));
  }

  const etiquetas = {
    reservada: "Reservada",
    asistida: "Asistió",
    cancelada: "Cancelada",
  };
  const fila = crearFila(
    [
      clase.fecha || "—",
      clase.horaInicio || "—",
      clase.tipo || "(clase eliminada)",
      nombreCompleto(reserva.cliente),
      nombreCompleto(clase.profesional),
      clase.sala ? clase.sala.nombre : "(sala eliminada)",
      crearEtiqueta(etiquetas[reserva.estado] || reserva.estado, `estado-${reserva.estado}`),
    ],
    acciones
  );
  fila.classList.add(`fila-${reserva.estado}`);
  return fila;
};
