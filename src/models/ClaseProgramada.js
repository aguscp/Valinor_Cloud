const mongoose = require("mongoose");

const claseProgramadaSchema = new mongoose.Schema(
  {
    horario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HorarioClase",
      required: true,
    },
    fecha: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener el formato YYYY-MM-DD"],
    },
    tipo: { type: String, required: true, trim: true },
    profesional: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Profesional",
      required: true,
    },
    sala: { type: mongoose.Schema.Types.ObjectId, ref: "Sala", required: true },
    horaInicio: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, "La hora debe tener el formato HH:mm"],
    },
    horaFin: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, "La hora debe tener el formato HH:mm"],
    },
    capacidad: { type: Number, required: true, min: 1 },
    reservas: { type: Number, default: 0, min: 0 },
    activa: { type: Boolean, default: true },
  },
  { timestamps: true }
);

claseProgramadaSchema.index({ horario: 1, fecha: 1 }, { unique: true });
claseProgramadaSchema.index({ fecha: 1, horaInicio: 1 });

module.exports = mongoose.model("ClaseProgramada", claseProgramadaSchema);
