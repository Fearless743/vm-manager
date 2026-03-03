import type { SiteConfigRecord } from "@vm-manager/shared";
import { getSiteConfig, updateSiteConfig } from "../data/store.js";

type UpdateSiteConfigInput = {
  siteTitle?: string;
  loginSubtitle?: string;
  sidebarTitle?: string;
};

export const readCurrentSiteConfig = async (): Promise<SiteConfigRecord> => {
  return getSiteConfig();
};

export const saveCurrentSiteConfig = async (input: UpdateSiteConfigInput): Promise<SiteConfigRecord> => {
  return updateSiteConfig(input);
};
