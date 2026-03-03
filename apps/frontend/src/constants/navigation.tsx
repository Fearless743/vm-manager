import type { ReactNode } from "react";
import {
  AppstoreOutlined,
  ControlOutlined,
  DesktopOutlined,
  SettingOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import type { PageKey } from "../types";

export type NavMenuItem = {
  key: PageKey;
  label: string;
  icon: ReactNode;
};

export const adminMenu: NavMenuItem[] = [
  { key: "overview", label: "总览", icon: <AppstoreOutlined /> },
  { key: "hosts", label: "宿主机节点", icon: <DesktopOutlined /> },
  { key: "vms", label: "虚拟机", icon: <ControlOutlined /> },
  { key: "users", label: "用户管理", icon: <TeamOutlined /> },
  { key: "settings", label: "网站配置", icon: <SettingOutlined /> },
];

export const userMenu: NavMenuItem[] = [{ key: "my-vms", label: "我的虚拟机", icon: <ControlOutlined /> }];

export const pageToPath: Record<PageKey, string> = {
  overview: "/overview",
  hosts: "/hosts",
  vms: "/vms",
  users: "/users",
  settings: "/settings",
  "my-vms": "/my-vms",
};

export const pathToPage: Record<string, PageKey> = {
  "/overview": "overview",
  "/hosts": "hosts",
  "/vms": "vms",
  "/users": "users",
  "/settings": "settings",
  "/my-vms": "my-vms",
};
