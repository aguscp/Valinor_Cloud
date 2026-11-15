const mongoose = require("mongoose");

const configuracionClaseSchema = new mongoose.Schema(
  {
    clave: { type: String, enum: ["general"], unique: true, required: true },
    duracionMinutos: {
      type: Number,
      default: 60,
      min: [15, "La duración mínima es de 15 minutos"],
      max: [240, "La duración máxima es de 240 minutos"],
      validate: {
        validator: Number.isInteger,
        message: "La duración debe ser un número entero de minutos",
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ConfiguracionClase", configuracionClaseSchema);
