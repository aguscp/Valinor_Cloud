const mongoose = require("mongoose");

const fechaEsValida = (valor) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
};

const horarioClaseSchema = new mongoose.Schema(
  {
    profesional: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Profesional",
      required: [true, "El profesional es obligatorio"],
    },
    tipo: {
      type: String,
      required: [true, "El tipo de clase es obligatorio"],
      trim: true,
      maxlength: [80, "El tipo de clase no puede superar los 80 caracteres"],
    },
    comienzaDesde: {
      type: String,
      required: [true, "La fecha de inicio es obligatoria"],
      validate: {
        validator: fechaEsValida,
        message: "La fecha de inicio debe tener el formato YYYY-MM-DD y ser válida",
      },
    },
    repetirSemanas: {
      type: Number,
      required: [true, "La cantidad de semanas es obligatoria"],
      min: [1, "La repetición mínima es de 1 semana"],
      max: [8, "La repetición máxima es de 8 semanas"],
      validate: { validator: Number.isInteger, message: "La cantidad de semanas debe ser entera" },
    },
    horaInicio: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, "La hora debe tener el formato HH:mm"],
    },
    sala: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sala",
      required: [true, "La sala es obligatoria"],
    },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HorarioClase", horarioClaseSchema);
