import { Schema, model } from "mongoose";

const addressSchema = new Schema(
  {
    label: { type: String, default: "Principal" }, // ej. "Casa", "Oficina"
    address: { type: String, required: true },
    city: { type: String },
    phone: { type: String },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true },
);

const customerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true }, // hash bcrypt
    phone: { type: String },
    addresses: { type: [addressSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default model("Customer", customerSchema);
