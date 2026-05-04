// Vercel serverless catch-all handler — forwards every /api/* request to
// the existing Express application so the full API works on Vercel.
export { default } from "../artifacts/api-server/src/app";
