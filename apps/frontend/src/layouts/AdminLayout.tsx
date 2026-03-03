import { LogoutOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Button, Layout, Menu, Space, Typography } from "antd";
import type { MenuProps } from "antd";
import type { ReactNode } from "react";
import type { Session, SiteConfig } from "../types";

const { Content, Header, Sider } = Layout;

type LayoutMenuItem = {
  key: string;
  label: string;
  icon: ReactNode;
};

type Props = {
  siteConfig: SiteConfig;
  session: Session;
  selectedPage: string;
  menuItems: LayoutMenuItem[];
  onNavigate: (key: string) => void;
  onOpenChangePassword: () => void;
  onLogout: () => void;
  children: ReactNode;
};

export function AdminLayout(props: Props): JSX.Element {
  const items: MenuProps["items"] = props.menuItems.map((item) => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
  }));

  return (
    <Layout className="admin-layout">
      <Sider className="admin-sider" width={240} breakpoint="lg" collapsedWidth={0}>
        <div className="sider-brand">
          <Typography.Title level={4} style={{ color: "#f5f8ff", marginBottom: 0 }}>
            {props.siteConfig.sidebarTitle}
          </Typography.Title>
          <Typography.Text style={{ color: "#9bb3ff" }}>
            {props.session.user.username} ({props.session.user.role})
          </Typography.Text>
        </div>
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[props.selectedPage]}
          items={items}
          onClick={(event) => props.onNavigate(event.key)}
        />
      </Sider>

      <Layout>
        <Header className="admin-header">
          <Space>
            <Button icon={<SafetyCertificateOutlined />} onClick={props.onOpenChangePassword}>
              修改密码
            </Button>
            <Button icon={<LogoutOutlined />} danger onClick={props.onLogout}>
              退出登录
            </Button>
          </Space>
        </Header>
        <Content className="admin-content">{props.children}</Content>
      </Layout>
    </Layout>
  );
}
