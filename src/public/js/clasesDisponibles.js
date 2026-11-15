const selectorDias = document.getElementById("selectorDias");
const tituloSemana = document.getElementById("tituloSemana");
const fechaSeleccionada = document.getElementById("fechaSeleccionada");
const semanaAnterior = document.getElementById("semanaAnterior");
const semanaSiguiente = document.getElementById("semanaSiguiente");
const buscarClase = document.getElementById("buscarClase");
const listaClases = document.getElementById("listaClases");
const errorClases = document.getElementById("errorClases");
const sinClases = document.getElementById("sinClases");
const sinResultados = document.getElementById("sinResultados");
const modalDetalleClase = document.getElementById("modalDetalleClase");
const detalleClase = document.getElementById("detalleClase");
const errorReservaClase = document.getElementById("errorReservaClase");
const botonReservar = document.getElementById("reservarClase");
const tablaReservas = document.getElementById("tablaReservas");
const errorReservas = document.getElementById("errorReservas");
const sinReservas = document.getElementById("sinReservas");

const formateadorFecha = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const formateadorFechaLarga = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const nombresDias = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const fechaEnArgentina = () => {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .reduce((resultado, parte) => {
      resultado[parte.type] = parte.value;
      return resultado;
    }, {});
  return `${partes.year}-${partes.month}-${partes.day}`;
};

const fechaUtc = (fecha) => new Date(`${fecha}T12:00:00Z`);
const fechaIso = (fecha) => fecha.toISOString().slice(0, 10);
const sumarDias = (fecha, cantidad) => {
  const resultado = fechaUtc(fecha);
  resultado.setUTCDate(resultado.getUTCDate() + cantidad);
  return fechaIso(resultado);
};
const inicioDeSemana = (fecha) => {
  const dia = fechaUtc(fecha).getUTCDay();
  return sumarDias(fecha, -((dia + 6) % 7));
};
const fechaLegible = (fecha) => formateadorFechaLarga.format(fechaUtc(fecha));
const normalizarTexto = (texto) =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-AR");

const hoy = fechaEnArgentina();
let semanaActual = inicioDeSemana(hoy);
let diaSeleccionado = hoy;
let clases = [];
let claseSeleccionada = null;

const renderizarDias = () => {
  const botones = Array.from({ length: 7 }, (_, indice) => {
    const fecha = sumarDias(semanaActual, indice);
    const fechaDate = fechaUtc(fecha);
    const esSeleccionado = fecha === diaSeleccionado;
    const esHoy = fecha === hoy;
    const yaPaso = fecha < hoy;
    const boton = document.createElement("button");
    boton.type = "button";
    boton.setAttribute("aria-pressed", String(esSeleccionado));
    boton.setAttribute("aria-label", fechaLegible(fecha));
    if (esHoy) boton.setAttribute("aria-current", "date");
    boton.className = [
      "flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca",
      yaPaso
        ? esSeleccionado
          ? "border-gray-400 bg-gray-300 text-gray-700 shadow-sm"
          : "border-gray-200 bg-gray-100 text-gray-400 hover:border-gray-300 hover:bg-gray-200"
        : esSeleccionado
          ? "border-marca bg-marca text-white shadow-sm"
          : "border-gray-200 bg-white text-gray-800 hover:border-marca/50 hover:bg-lavanda-50",
    ].join(" ");

    const nombre = document.createElement("span");
    nombre.className = "text-xs font-semibold uppercase";
    nombre.textContent = nombresDias[indice];
    const numero = document.createElement("span");
    numero.className = "text-lg font-bold leading-none";
    numero.textContent = String(fechaDate.getUTCDate());
    const mes = document.createElement("span");
    mes.className = esSeleccionado ? "text-xs text-white/80" : "text-xs text-gray-500";
    mes.textContent = new Intl.DateTimeFormat("es-AR", {
      month: "short",
      timeZone: "UTC",
    }).format(fechaDate);
    boton.append(nombre, numero, mes);

    if (esHoy) {
      const marcaHoy = document.createElement("span");
      marcaHoy.className = esSeleccionado
        ? "mt-1 size-1 rounded-full bg-white"
        : "mt-1 size-1 rounded-full bg-marca";
      marcaHoy.title = "Hoy";
      boton.appendChild(marcaHoy);
    }

    boton.addEventListener("click", () => {
      diaSeleccionado = fecha;
      renderizarDias();
      renderizarClases();
    });
    return boton;
  });
  selectorDias.replaceChildren(...botones);

  const ultimoDia = sumarDias(semanaActual, 6);
  tituloSemana.textContent = `${formateadorFecha.format(fechaUtc(semanaActual))} – ${formateadorFecha.format(fechaUtc(ultimoDia))}`;
};

const agregarDetalle = (etiqueta, valor) => {
  const linea = document.createElement("p");
  const nombre = document.createElement("span");
  nombre.className = "font-semibold text-gray-900";
  nombre.textContent = `${etiqueta}: `;
  linea.append(nombre, document.createTextNode(valor));
  detalleClase.appendChild(linea);
};

const abrirDetalleClase = (clase) => {
  claseSeleccionada = clase;
  detalleClase.replaceChildren();
  agregarDetalle("Actividad", clase.tipo);
  agregarDetalle("Fecha", fechaLegible(clase.fecha));
  agregarDetalle("Horario", `${clase.horaInicio}–${clase.horaFin}`);
  agregarDetalle(
    "Instructor",
    clase.profesional
      ? `${clase.profesional.nombre} ${clase.profesional.apellido}`
      : "No disponible"
  );
  agregarDetalle("Sala", clase.sala ? clase.sala.nombre : "No disponible");
  agregarDetalle(
    "Disponibilidad",
    clase.reservas >= clase.capacidad
      ? "Cupo completo"
      : `${clase.capacidad - clase.reservas} de ${clase.capacidad} lugares disponibles`
  );
  if (clase.reservadaPorMi) agregarDetalle("Tu reserva", "Ya tenés un lugar reservado");
  if (botonReservar) {
    botonReservar.disabled =
      clase.reservas >= clase.capacidad || clase.reservadaPorMi;
    botonReservar.textContent = clase.reservas >= clase.capacidad
      ? "Cupo completo"
      : clase.reservadaPorMi
        ? "Ya reservaste"
        : "Reservar lugar";
    mostrarError(errorReservaClase, "");
  }
  modalDetalleClase.hidden = false;
  modalDetalleClase.querySelector(".btn-cerrar-modal").focus();
};

const crearTarjetaClase = (clase) => {
  const completa = clase.reservas >= clase.capacidad;
  const tarjeta = document.createElement("button");
  tarjeta.type = "button";
  tarjeta.className = [
    "flex w-full flex-col items-start gap-3 rounded-xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca",
    completa
      ? "border-gray-200 bg-gray-100 text-gray-500"
      : "border-gray-200 bg-white text-gray-800 hover:border-marca/40",
  ].join(" ");
  tarjeta.setAttribute("aria-label", `Ver detalle de ${clase.tipo}, ${clase.horaInicio}`);

  const titulo = document.createElement("span");
  titulo.className = "text-lg font-semibold text-gray-900";
  titulo.textContent = clase.tipo;
  const horario = document.createElement("span");
  horario.className = "text-sm text-gray-700";
  horario.textContent = `${clase.horaInicio}–${clase.horaFin}`;
  const instructor = document.createElement("span");
  instructor.className = "text-sm text-gray-600";
  instructor.textContent = clase.profesional
    ? `Instructor: ${clase.profesional.nombre} ${clase.profesional.apellido}`
    : "Instructor no disponible";
  const cupo = document.createElement("span");
  cupo.className = "text-sm font-semibold";
  cupo.textContent = clase.reservadaPorMi
    ? "Tu lugar está reservado"
    : completa
      ? "Cupo completo"
      : `${clase.capacidad - clase.reservas} lugares disponibles`;
  tarjeta.append(titulo, horario, instructor, cupo);
  tarjeta.addEventListener("click", () => abrirDetalleClase(clase));
  return tarjeta;
};

const renderizarClases = () => {
  const busqueda = normalizarTexto(buscarClase.value.trim());
  const delDia = clases.filter((clase) => clase.fecha === diaSeleccionado);
  const filtradas = delDia.filter((clase) => normalizarTexto(clase.tipo).includes(busqueda));

  listaClases.replaceChildren(...filtradas.map(crearTarjetaClase));
  sinClases.hidden = delDia.length > 0;
  sinResultados.hidden = delDia.length === 0 || filtradas.length > 0;
  fechaSeleccionada.textContent = fechaLegible(diaSeleccionado);
};

const cargarClases = async () => {
  try {
    clases = await api("/api/clases/disponibles");
    renderizarClases();
    mostrarError(errorClases, "");
  } catch (error) {
    mostrarError(errorClases, error.message);
  }
};

const cargarReservas = async () => {
  try {
    const reservas = await api("/api/clases/mis-reservas");
    const filas = reservas.map((reserva) =>
      crearFilaReservaClase(reserva, cargarDatos, (mensaje) => mostrarError(errorReservas, mensaje))
    );
    tablaReservas.replaceChildren(...filas);
    sinReservas.hidden = filas.length > 0;
    mostrarError(errorReservas, "");
  } catch (error) {
    mostrarError(errorReservas, error.message);
  }
};

const cargarDatos = async () => {
  const tareas = [cargarClases()];
  if (botonReservar) tareas.push(cargarReservas());
  await Promise.all(tareas);
};

semanaAnterior.addEventListener("click", () => {
  semanaActual = sumarDias(semanaActual, -7);
  diaSeleccionado = sumarDias(diaSeleccionado, -7);
  renderizarDias();
  renderizarClases();
});

semanaSiguiente.addEventListener("click", () => {
  semanaActual = sumarDias(semanaActual, 7);
  diaSeleccionado = sumarDias(diaSeleccionado, 7);
  renderizarDias();
  renderizarClases();
});

buscarClase.addEventListener("input", renderizarClases);
if (botonReservar) {
  botonReservar.addEventListener("click", async () => {
    if (!claseSeleccionada || botonReservar.disabled) return;
    botonReservar.disabled = true;
    mostrarError(errorReservaClase, "");
    try {
      await api(`/api/clases/${claseSeleccionada._id}/reservas`, { method: "POST" });
      modalDetalleClase.hidden = true;
      await cargarDatos();
    } catch (error) {
      mostrarError(errorReservaClase, error.message);
      botonReservar.disabled = false;
      await cargarDatos();
    }
  });
}

configurarModal(modalDetalleClase);
renderizarDias();
renderizarClases();
cargarDatos();
