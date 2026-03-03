import type { RequestHandler } from "express";
import { systemOptions } from "../constants/systemOptions.js";

export const listSystemOptionsHandler: RequestHandler = (_req, res) => {
  res.json(systemOptions);
};
