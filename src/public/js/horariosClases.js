const formHorario = document.getElementById("formHorario");
const errorHorario = document.getElementById("errorHorario");
const mensajeHorario = document.getElementById("mensajeHorario");
const selectorProfesional = formHorario.profesional;
const selectorSala = formHorario.sala;
const campoHora = formHorario.horaInicio;
const campoTipo = formHorario.tipo;
const campoComienzaDesde = formHorario.comienzaDesde;
const campoRepetirSemanas = formHorario.repetirSemanas;
const duracionHorario = document.getElementById("duracionHorario");
const tablaHorarios = document.getElementById("tablaHorarios");
const sinHorarios = document.getElementById("sinHorarios");
const errorListadoHorarios = document.getElementById("errorListadoHorarios");
const botonCancelar = document.getElementById("cancelarEdicionHorario");
const textoGuardar = document.getElementById("textoGuardarHorario");
let duracionMinutos = 60;
let idEditando = null;
let profesionales = [];

const fechaHoy = () => {
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

const sumarDias = (fechaTexto, dias) => {
  const fecha = new Date(`${fechaTexto}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
};

const primeraClase = (horario) => {
  return horario.comienzaDesde;
};

const fechaLegible = (fechaTexto) =>
  new Date(`${fechaTexto}T12:00:00Z`).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

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
  if (!campoComienzaDesde.value || !campoHora.value) {
    selectorSala.replaceChildren(new Option("Elegí fecha y hora", ""));
    return;
  }
  if (!campoRepetirSemanas.value) {
    selectorSala.replaceChildren(new Option("Elegí fecha y repetición", ""));
    return;
  }
  if (selectorProfesional && !selectorProfesional.value) {
    selectorSala.replaceChildren(new Option("Seleccioná un profesor", ""));
    return;
  }
  try {
    const parametros = new URLSearchParams({
      horaInicio: campoHora.value,
      comienzaDesde: campoComienzaDesde.value,
      repetirSemanas: campoRepetirSemanas.value,
    });
    if (selectorProfesional) parametros.set("profesional", selectorProfesional.value);
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
  if (selectorProfesional) selectorProfesional.value = "";
  campoComienzaDesde.value = fechaHoy();
  campoRepetirSemanas.value = "8";
  selectorSala.replaceChildren(new Option("Elegí fecha y hora", ""));
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
      if (selectorProfesional) selectorProfesional.value = horario.profesional?._id || "";
      campoTipo.value = horario.tipo;
      campoHora.value = horario.horaInicio;
      campoComienzaDesde.value = horario.comienzaDesde;
      campoRepetirSemanas.value = String(horario.repetirSemanas);
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
  const totalMinutos = Number(horario.horaInicio.slice(0, 2)) * 60 +
    Number(horario.horaInicio.slice(3)) + duracionMinutos;
  const horaFin = `${String(Math.floor(totalMinutos / 60)).padStart(2, "0")}:${String(totalMinutos % 60).padStart(2, "0")}`;
  const inicioVigencia = primeraClase(horario);
  const finVigencia = sumarDias(inicioVigencia, (horario.repetirSemanas - 1) * 7);
  const finalizado = finVigencia < fechaHoy();
  return crearFila([
    horario.tipo,
    ...(selectorProfesional
      ? [horario.profesional
        ? `${horario.profesional.apellido}, ${horario.profesional.nombre}`
        : "Profesor no disponible"]
      : []),
    `${horario.horaInicio}–${horaFin}`,
    `${fechaLegible(inicioVigencia)} – ${fechaLegible(finVigencia)} (${horario.repetirSemanas} ${horario.repetirSemanas === 1 ? "semana" : "semanas"})`,
    horario.sala
      ? `${horario.sala.nombre}${horario.sala.activa ? "" : " (inactiva)"}`
      : "Sala inactiva",
    horario.sala ? String(horario.sala.capacidad) : "-",
    crearEtiqueta(
      finalizado ? "finalizado" : horario.activo ? "activo" : "inactivo",
      finalizado || !horario.activo ? "etiqueta-neutra" : "etiqueta-exito"
    ),
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

const cargarProfesionales = async () => {
  if (!selectorProfesional) return;
  try {
    profesionales = await api("/api/profesionales");
    selectorProfesional.replaceChildren(new Option("Seleccioná un profesor", ""));
    profesionales.forEach((profesional) => {
      selectorProfesional.add(
        new Option(`${profesional.apellido}, ${profesional.nombre}`, profesional._id)
      );
    });
    if (profesionales.length === 0) {
      selectorProfesional.replaceChildren(new Option("No hay profesores registrados", ""));
    }
    selectorProfesional.disabled = profesionales.length === 0;
  } catch (error) {
    selectorProfesional.replaceChildren(new Option("No se pudieron cargar los profesores", ""));
    mostrarError(errorHorario, error.message);
  }
};

if (selectorProfesional) selectorProfesional.addEventListener("change", cargarSalasDisponibles);
campoComienzaDesde.addEventListener("change", cargarSalasDisponibles);
campoRepetirSemanas.addEventListener("change", cargarSalasDisponibles);
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
    if (campoComienzaDesde.value && campoHora.value) await cargarSalasDisponibles();
  }
});

campoComienzaDesde.value = fechaHoy();
campoRepetirSemanas.value = "8";
sincronizarFin();
Promise.all([cargarProfesionales(), cargarHorarios()]);
