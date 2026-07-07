import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 200,
  message: {
    status: 429,
    error: "Too many request",
  },
});

export default limiter;
