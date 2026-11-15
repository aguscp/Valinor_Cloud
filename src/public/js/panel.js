const tablaReservas = document.getElementById("tablaReservas");
const sinReservas = document.getElementById("sinReservas");
const errorReservas = document.getElementById("errorReservas");

const fechaDeHoy = () => {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value])
  );
  return `${partes.year}-${partes.month}-${partes.day}`;
};

const actualizarResumen = (reservas) => {
  const contar = (estado) => reservas.filter((reserva) => reserva.estado === estado).length;
  document.getElementById("cantidadReservados").textContent = contar("reservada");
  document.getElementById("cantidadAtendidos").textContent = contar("asistida");
  document.getElementById("cantidadCancelados").textContent = contar("cancelada");
};

const cargarReservasDeHoy = async () => {
  try {
    const reservas = await api(`/api/clases/reservas?fecha=${fechaDeHoy()}`);
    tablaReservas.replaceChildren(
      ...reservas.map((reserva) =>
        crearFilaReservaClase(reserva, cargarReservasDeHoy, (mensaje) =>
          mostrarError(errorReservas, mensaje)
        )
      )
    );
    sinReservas.hidden = reservas.length > 0;
    actualizarResumen(reservas);
    mostrarError(errorReservas, "");
  } catch (error) {
    mostrarError(errorReservas, error.message);
  }
};

cargarReservasDeHoy();
