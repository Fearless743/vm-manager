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
          <Typography.Text className="sider-brand-label">Control Surface</Typography.Text>
          <Typography.Title level={4} className="sider-brand-title">
            {props.siteConfig.sidebarTitle}
          </Typography.Title>
          <Typography.Text className="sider-brand-user">
            {props.session.user.username} ({props.session.user.role})
          </Typography.Text>
        </div>
        <Menu
          className="admin-menu"
          mode="inline"
          theme="dark"
          selectedKeys={[props.selectedPage]}
          items={items}
          onClick={(event) => props.onNavigate(event.key)}
        />
      </Sider>

      <Layout>
        <Header className="admin-header">
          <Space className="admin-header-actions">
            <Button className="header-action-btn" icon={<SafetyCertificateOutlined />} onClick={props.onOpenChangePassword}>
              修改密码
            </Button>
            <Button className="header-action-btn header-action-btn-danger" icon={<LogoutOutlined />} danger onClick={props.onLogout}>
              退出登录
            </Button>
          </Space>
        </Header>
        <Content className="admin-content">{props.children}</Content>
      </Layout>
    </Layout>
  );
}
