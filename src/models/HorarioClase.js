const mongoose = require("mongoose");

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
    diaSemana: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
      validate: { validator: Number.isInteger, message: "El día no es válido" },
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
