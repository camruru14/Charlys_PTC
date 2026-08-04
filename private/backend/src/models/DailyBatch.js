import { Schema, model } from "mongoose";

const dailyBatchSchema = new Schema(
  {
    dailyBatchNumber: {
      type: String,
      required: true,
      unique: true,
    },
    date: {
      type: Date,
      required: true,
    },
    product: {
      type: String,
      required: true,
    },
    color: {
      type: String,
    },
    targetQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

export default model("DailyBatch", dailyBatchSchema);
