const tablaReservas = document.getElementById("tablaReservas");
const sinReservas = document.getElementById("sinReservas");
const errorReservas = document.getElementById("errorReservas");
const formAlta = document.getElementById("formAlta");
const errorAlta = document.getElementById("errorAlta");
const mensajeAlta = document.getElementById("mensajeAlta");
const formFiltros = document.getElementById("formFiltros");
let clasesDisponibles = [];

const mostrarErrorReservas = (mensaje) => mostrarError(errorReservas, mensaje);

const cargarReservas = async () => {
  const filtros = new URLSearchParams();
  Object.entries(leerFormulario(formFiltros)).forEach(([clave, valor]) => {
    if (valor) filtros.append(clave, valor);
  });

  try {
    const reservas = await api(`/api/clases/reservas?${filtros}`);
    tablaReservas.replaceChildren(
      ...reservas.map((reserva) =>
        crearFilaReservaClase(
          reserva,
          async () => {
            await cargarReservas();
            if (formAlta) await cargarOpcionesAlta();
          },
          mostrarErrorReservas
        )
      )
    );
    sinReservas.hidden = reservas.length > 0;
    mostrarErrorReservas("");
  } catch (error) {
    mostrarErrorReservas(error.message);
  }
};

const cargarOpcionesAlta = async () => {
  const [clientes, clases] = await Promise.all([
    api("/api/clientes"),
    api("/api/clases/para-reservar"),
  ]);
  clasesDisponibles = clases;
  llenarSelect(formAlta.cliente, clientes, (c) => `${c.apellido}, ${c.nombre} (DNI ${c.dni})`);
  formAlta.clase.replaceChildren(
    new Option(
      clases.length ? "Seleccioná una clase" : "No hay clases futuras con cupos disponibles",
      ""
    )
  );
  clases.forEach((clase) => {
    const fecha = new Date(`${clase.fecha}T12:00:00Z`).toLocaleDateString("es-AR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
    const lugares = clase.capacidad - clase.reservas;
    const profesional = clase.profesional
      ? `${clase.profesional.apellido}, ${clase.profesional.nombre}`
      : "Instructor no disponible";
    const opcion = new Option(
      `${fecha} · ${clase.horaInicio} · ${clase.tipo} · ${profesional} · ${lugares} lugares`,
      clase._id
    );
    opcion.disabled = lugares <= 0;
    formAlta.clase.add(opcion);
  });
};

if (formAlta) {
  const detalleClaseAlta = document.getElementById("detalleClaseAlta");

  formAlta.clase.addEventListener("change", () => {
    mensajeAlta.hidden = true;
    const clase = clasesDisponibles.find((item) => item._id === formAlta.clase.value);
    detalleClaseAlta.textContent = clase
      ? `${clase.tipo} · ${new Date(`${clase.fecha}T12:00:00Z`).toLocaleDateString("es-AR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        })} · ${clase.horaInicio}–${clase.horaFin} · ${clase.sala ? clase.sala.nombre : "Sala no disponible"} · ${clase.capacidad - clase.reservas} lugares disponibles`
      : "";
    detalleClaseAlta.hidden = !clase;
  });
  formAlta.cliente.addEventListener("change", () => {
    mensajeAlta.hidden = true;
  });

  formAlta.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mostrarError(errorAlta, "");
    mensajeAlta.hidden = true;
    const { cliente, clase } = leerFormulario(formAlta);
    const clienteSeleccionado = formAlta.cliente.selectedOptions[0].textContent;
    const claseSeleccionada = formAlta.clase.selectedOptions[0].textContent;
    try {
      await api(`/api/clases/${clase}/reservas-para-cliente`, {
        method: "POST",
        body: { cliente },
      });
    } catch (error) {
      mostrarError(errorAlta, error.message);
      return;
    }

    formAlta.reset();
    detalleClaseAlta.hidden = true;
    mensajeAlta.textContent = `Se reservó ${claseSeleccionada} para ${clienteSeleccionado}.`;
    mensajeAlta.hidden = false;
    await cargarOpcionesAlta().catch((error) =>
      mostrarError(errorAlta, `La reserva se creó, pero no se pudo actualizar la lista: ${error.message}`)
    );
    await cargarReservas();
  });

  cargarOpcionesAlta().catch((error) => mostrarError(errorAlta, error.message));
}

formFiltros.addEventListener("change", cargarReservas);
document.getElementById("btnLimpiarFiltros").addEventListener("click", () => {
  formFiltros.reset();
  cargarReservas();
});

cargarReservas();
