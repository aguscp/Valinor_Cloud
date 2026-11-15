const formRegistro = document.getElementById("formRegistro");
const errorRegistro = document.getElementById("errorRegistro");

formRegistro.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarError(errorRegistro, "");

  const datos = leerFormulario(formRegistro);
  if (datos.password !== datos.passwordConfirmar) {
    mostrarError(errorRegistro, "Las contraseñas no coinciden");
    formRegistro.passwordConfirmar.focus();
    return;
  }
  delete datos.passwordConfirmar;

  try {
    await api("/api/auth/registro-clientes", { method: "POST", body: datos });
    location.href = "/clases";
  } catch (error) {
    mostrarError(errorRegistro, error.message);
  }
});
