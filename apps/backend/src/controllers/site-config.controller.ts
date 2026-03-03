import type { RequestHandler } from "express";
import { readCurrentSiteConfig, saveCurrentSiteConfig } from "../services/siteConfig.service.js";

export const getSiteConfigHandler: RequestHandler = async (_req, res) => {
  const siteConfig = await readCurrentSiteConfig();
  res.json(siteConfig);
};

export const updateSiteConfigHandler: RequestHandler = async (req, res) => {
  const { siteTitle, loginSubtitle, sidebarTitle } = req.body as {
    siteTitle?: string;
    loginSubtitle?: string;
    sidebarTitle?: string;
  };
  const updated = await saveCurrentSiteConfig({ siteTitle, loginSubtitle, sidebarTitle });
  res.json(updated);
};
