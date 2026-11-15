// Integración con Gemini para el asistente del chat.
const { GoogleGenerativeAI } = require("@google/generative-ai");

const MODELO = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

// Contexto: define cómo debe comportarse el asistente en cada respuesta.
const CONTEXTO = `Sos el asistente virtual de TurnoFlex, una aplicación para gestionar clases
grupales y reservas de un centro de pilates, yoga y bienestar. Ayudás a clientes y al personal
con dudas generales sobre el uso del sistema.
Los profesores publican clases semanales con fecha de inicio, repetición de hasta 8 semanas
y sala disponible. Los clientes pueden reservar clases futuras con cupo y cancelar antes
del inicio. Las reservas guardan historial; sus estados son reservada, asistida o cancelada.
Respondé en español, de forma clara y breve (menos de 600 caracteres). Si no sabés algo,
decilo. No inventes datos de clientes, clases ni reservas.`;

const TIEMPO_MAXIMO_MS = 10000;

// El modelo se crea una sola vez y se reutiliza en todas las consultas.
let modelo = null;
const obtenerModelo = () => {
  if (!process.env.GEMINI_API_KEY) throw new Error("Falta la variable GEMINI_API_KEY");
  if (!modelo) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    modelo = genAI.getGenerativeModel({ model: MODELO, systemInstruction: CONTEXTO });
  }
  return modelo;
};

// Envía la pregunta a Gemini y devuelve el texto de la respuesta.
// Si Gemini no responde en el tiempo estipulado, se corta la espera con un error.
const consultarIA = async (pregunta) => {
  let temporizador;
  const respuesta = obtenerModelo().generateContent(pregunta);
  const limite = new Promise((_, rechazar) => {
    temporizador = setTimeout(
      () => rechazar(new Error("Gemini tardó demasiado en responder")),
      TIEMPO_MAXIMO_MS
    );
  });
  try {
    const resultado = await Promise.race([respuesta, limite]);
    return resultado.response.text().trim();
  } finally {
    clearTimeout(temporizador);
  }
};

module.exports = { consultarIA };