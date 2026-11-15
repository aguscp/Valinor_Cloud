const formDuracion = document.getElementById("formDuracion");
const errorDuracion = document.getElementById("errorDuracion");
const mensajeDuracion = document.getElementById("mensajeDuracion");
const formAltaSala = document.getElementById("formAltaSala");
const errorAltaSala = document.getElementById("errorAltaSala");
const tablaSalas = document.getElementById("tablaSalas");
const sinSalas = document.getElementById("sinSalas");
const errorSalas = document.getElementById("errorSalas");
const modalEditarSala = document.getElementById("modalEditarSala");
const formEditarSala = document.getElementById("formEditarSala");
const errorEdicionSala = document.getElementById("errorEdicionSala");

const actualizarConfiguracion = async () => {
  try {
    const configuracion = await api("/api/clases/configuracion");
    formDuracion.duracionMinutos.value = configuracion.duracionMinutos;
  } catch (error) {
    mostrarError(errorDuracion, error.message);
  }
};

const crearFilaSala = (sala) => {
  const acciones = [
    crearBoton("Editar", "btn-editar", () => {
      llenarFormulario(formEditarSala, sala);
      formEditarSala._id.value = sala._id;
      mostrarError(errorEdicionSala, "");
      modalEditarSala.hidden = false;
    }),
    crearBoton(sala.activa ? "Desactivar" : "Activar", "btn-secundario", async () => {
      try {
        await api(`/api/salas/${sala._id}`, {
          method: "PUT",
          body: { activa: !sala.activa },
        });
        await cargarSalas();
      } catch (error) {
        mostrarError(errorSalas, error.message);
      }
    }),
  ];
  return crearFila([
    sala.nombre,
    String(sala.capacidad),
    crearEtiqueta(sala.activa ? "activa" : "inactiva", sala.activa ? "etiqueta-exito" : "etiqueta-neutra"),
  ], acciones);
};

const cargarSalas = async () => {
  try {
    const salas = await api("/api/salas");
    tablaSalas.replaceChildren(...salas.map(crearFilaSala));
    sinSalas.hidden = salas.length > 0;
    mostrarError(errorSalas, "");
  } catch (error) {
    mostrarError(errorSalas, error.message);
  }
};

formDuracion.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarError(errorDuracion, "");
  mensajeDuracion.hidden = true;
  try {
    const configuracion = await api("/api/clases/configuracion", {
      method: "PUT",
      body: leerFormulario(formDuracion),
    });
    formDuracion.duracionMinutos.value = configuracion.duracionMinutos;
    mensajeDuracion.textContent = "La duración de las clases se actualizó.";
    mensajeDuracion.hidden = false;
  } catch (error) {
    mostrarError(errorDuracion, error.message);
  }
});

formAltaSala.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarError(errorAltaSala, "");
  try {
    await api("/api/salas", { method: "POST", body: leerFormulario(formAltaSala) });
    formAltaSala.reset();
    await cargarSalas();
  } catch (error) {
    mostrarError(errorAltaSala, error.message);
  }
});

formEditarSala.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarError(errorEdicionSala, "");
  const { _id, ...datos } = leerFormulario(formEditarSala);
  try {
    await api(`/api/salas/${_id}`, { method: "PUT", body: datos });
    modalEditarSala.hidden = true;
    await cargarSalas();
  } catch (error) {
    mostrarError(errorEdicionSala, error.message);
  }
});

configurarModal(modalEditarSala);
actualizarConfiguracion();
cargarSalas();
