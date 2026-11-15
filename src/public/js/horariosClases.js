const formHorario = document.getElementById("formHorario");
const errorHorario = document.getElementById("errorHorario");
const mensajeHorario = document.getElementById("mensajeHorario");
const selectorSala = formHorario.sala;
const campoDia = formHorario.diaSemana;
const campoHora = formHorario.horaInicio;
const campoTipo = formHorario.tipo;
const duracionHorario = document.getElementById("duracionHorario");
const tablaHorarios = document.getElementById("tablaHorarios");
const sinHorarios = document.getElementById("sinHorarios");
const errorListadoHorarios = document.getElementById("errorListadoHorarios");
const botonCancelar = document.getElementById("cancelarEdicionHorario");
const textoGuardar = document.getElementById("textoGuardarHorario");
const nombresDias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
let duracionMinutos = 60;
let idEditando = null;

const sincronizarFin = () => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(campoHora.value)) {
    duracionHorario.textContent = `Cada clase dura ${duracionMinutos} minutos.`;
    return;
  }
  const [horas, minutos] = campoHora.value.split(":").map(Number);
  const fin = horas * 60 + minutos + duracionMinutos;
  if (fin >= 24 * 60) {
    duracionHorario.textContent = "La clase debe terminar antes de la medianoche.";
    return;
  }
  duracionHorario.textContent = `Horario: ${campoHora.value} a ${String(Math.floor(fin / 60)).padStart(2, "0")}:${String(fin % 60).padStart(2, "0")} (${duracionMinutos} min).`;
};

const cargarSalasDisponibles = async () => {
  selectorSala.disabled = true;
  selectorSala.replaceChildren(new Option("Buscando salas disponibles…", ""));
  if (!campoDia.value || !campoHora.value) {
    selectorSala.replaceChildren(new Option("Elegí día y hora", ""));
    return;
  }
  try {
    const parametros = new URLSearchParams({
      diaSemana: campoDia.value,
      horaInicio: campoHora.value,
    });
    if (idEditando) parametros.set("excluirId", idEditando);
    const salas = await api(`/api/clases/horarios/salas-disponibles?${parametros}`);
    selectorSala.replaceChildren(new Option(
      salas.length ? "Seleccioná una sala" : "No hay salas disponibles",
      ""
    ));
    salas.forEach((sala) => {
      selectorSala.add(new Option(`${sala.nombre} · ${sala.capacidad} lugares`, sala._id));
    });
    selectorSala.disabled = salas.length === 0;
  } catch (error) {
    selectorSala.replaceChildren(new Option("No se pudieron cargar las salas", ""));
    mostrarError(errorHorario, error.message);
  }
};

const resetearEdicion = () => {
  idEditando = null;
  formHorario.reset();
  selectorSala.replaceChildren(new Option("Elegí día y hora", ""));
  selectorSala.disabled = true;
  botonCancelar.hidden = true;
  textoGuardar.textContent = "Publicar horario";
  mensajeHorario.hidden = true;
  sincronizarFin();
};

const crearFilaHorario = (horario) => {
  const acciones = [
    crearBoton("Editar", "btn-editar", async () => {
      idEditando = horario._id;
      campoTipo.value = horario.tipo;
      campoDia.value = String(horario.diaSemana);
      campoHora.value = horario.horaInicio;
      botonCancelar.hidden = false;
      textoGuardar.textContent = "Guardar cambios";
      await cargarSalasDisponibles();
      selectorSala.value = horario.sala ? horario.sala._id : "";
      sincronizarFin();
      formHorario.scrollIntoView({ behavior: "smooth", block: "start" });
    }),
    crearBoton(horario.activo ? "Desactivar" : "Activar", "btn-secundario", async () => {
      try {
        await api(`/api/clases/horarios/${horario._id}`, {
          method: "PUT",
          body: { activo: !horario.activo },
        });
        await cargarHorarios();
      } catch (error) {
        mostrarError(errorListadoHorarios, error.message);
      }
    }),
  ];
  const fin = `${horario.fechaFin || ""}`;
  const totalMinutos = Number(horario.horaInicio.slice(0, 2)) * 60 +
    Number(horario.horaInicio.slice(3)) + duracionMinutos;
  const horaFin = fin || `${String(Math.floor(totalMinutos / 60)).padStart(2, "0")}:${String(totalMinutos % 60).padStart(2, "0")}`;
  return crearFila([
    horario.tipo,
    nombresDias[horario.diaSemana],
    `${horario.horaInicio}–${horaFin}`,
    horario.sala
      ? `${horario.sala.nombre}${horario.sala.activa ? "" : " (inactiva)"}`
      : "Sala inactiva",
    horario.sala ? String(horario.sala.capacidad) : "-",
    crearEtiqueta(horario.activo ? "activo" : "inactivo", horario.activo ? "etiqueta-exito" : "etiqueta-neutra"),
  ], acciones);
};

const cargarHorarios = async () => {
  try {
    const respuesta = await api("/api/clases/horarios");
    duracionMinutos = respuesta.duracionMinutos;
    duracionHorario.textContent = `Cada clase dura ${duracionMinutos} minutos.`;
    const horarios = respuesta.horarios;
    tablaHorarios.replaceChildren(...horarios.map(crearFilaHorario));
    sinHorarios.hidden = horarios.length > 0;
    mostrarError(errorListadoHorarios, "");
  } catch (error) {
    mostrarError(errorListadoHorarios, error.message);
  }
};

campoDia.addEventListener("change", cargarSalasDisponibles);
campoHora.addEventListener("change", () => {
  sincronizarFin();
  cargarSalasDisponibles();
});
campoHora.addEventListener("input", sincronizarFin);
botonCancelar.addEventListener("click", resetearEdicion);

formHorario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarError(errorHorario, "");
  mensajeHorario.hidden = true;
  const ruta = idEditando ? `/api/clases/horarios/${idEditando}` : "/api/clases/horarios";
  try {
    await api(ruta, { method: idEditando ? "PUT" : "POST", body: leerFormulario(formHorario) });
    resetearEdicion();
    mensajeHorario.textContent = "El horario semanal se guardó correctamente.";
    mensajeHorario.hidden = false;
    await cargarHorarios();
  } catch (error) {
    mostrarError(errorHorario, error.message);
    if (campoDia.value && campoHora.value) await cargarSalasDisponibles();
  }
});

sincronizarFin();
cargarHorarios();
