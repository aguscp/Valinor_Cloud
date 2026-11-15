const formPerfil = document.getElementById("formPerfil");
const errorPerfil = document.getElementById("errorPerfil");
const mensajeExito = document.getElementById("mensajeExito");
const camposEditables = ["nombre", "apellido", "telefono", "email"];
let perfilOriginal = null;

const normalizarValor = (campo, valor) => {
  const normalizado = valor.trim();
  return campo === "email" ? normalizado.toLocaleLowerCase("es-AR") : normalizado;
};

const obtenerDatosEditables = () =>
  Object.fromEntries(
    camposEditables.map((campo) => [
      campo,
      normalizarValor(campo, formPerfil.elements[campo].value),
    ])
  );

const cargarPerfil = async () => {
  try {
    const cliente = await api("/api/auth/yo/perfil");
    llenarFormulario(formPerfil, cliente);
    perfilOriginal = obtenerDatosEditables();
  } catch (error) {
    mostrarError(errorPerfil, error.message);
    formPerfil.querySelectorAll("input, button").forEach((campo) => {
      campo.disabled = true;
    });
  }
};

formPerfil.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarError(errorPerfil, "");
  mensajeExito.hidden = true;

  const datosEditables = obtenerDatosEditables();
  const huboCambios = camposEditables.some(
    (campo) => datosEditables[campo] !== perfilOriginal[campo]
  );
  if (!huboCambios) {
    mensajeExito.textContent = "No se han hecho cambios.";
    mensajeExito.hidden = false;
    return;
  }

  const datos = leerFormulario(formPerfil);
  delete datos.dni;

  try {
    const cliente = await api("/api/auth/yo/perfil", { method: "PUT", body: datos });
    llenarFormulario(formPerfil, cliente);
    perfilOriginal = obtenerDatosEditables();
    mensajeExito.textContent = "Tus datos se actualizaron correctamente.";
    mensajeExito.hidden = false;
  } catch (error) {
    mostrarError(errorPerfil, error.message);
  }
});

cargarPerfil();
