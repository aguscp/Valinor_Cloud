const mongoose = require("mongoose");

const reservaClaseSchema = new mongoose.Schema(
  {
    clase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClaseProgramada",
      required: true,
    },
    cliente: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cliente",
      required: true,
    },
    estado: {
      type: String,
      enum: ["reservada", "asistida", "cancelada"],
      default: "reservada",
    },
  },
  { timestamps: true, autoIndex: false }
);

reservaClaseSchema.index(
  { clase: 1, cliente: 1 },
  {
    name: "reserva_activa_por_cliente_clase",
    unique: true,
    partialFilterExpression: { estado: "reservada" },
  }
);
reservaClaseSchema.index({ cliente: 1, createdAt: -1 });

module.exports = mongoose.model("ReservaClase", reservaClaseSchema);
