import { PlusOutlined } from "@ant-design/icons";
import { Button, Card, Col, Form, Input, Row, Space, Statistic, Table, Tag, Typography } from "antd";
import type { TableColumnsType } from "antd";
import type { Role } from "@vm-manager/shared";
import { VmCardGrid } from "../../components/vm/VmCardGrid";
import type { HostRow, PageKey, UserRow, VmAction, VmRow } from "../../types";

type Props = {
  page: PageKey;
  currentUsername: string;
  vms: VmRow[];
  hosts: HostRow[];
  users: UserRow[];
  assignTargets: Record<string, string>;
  siteTitleInput: string;
  loginSubtitleInput: string;
  onSiteTitleInputChange: (value: string) => void;
  onLoginSubtitleInputChange: (value: string) => void;
  onSaveSiteConfig: () => void;
  onOpenCreateHost: () => void;
  onOpenCreateVm: () => void;
  onOpenCreateUser: () => void;
  onOpenEditUser: (user: UserRow) => void;
  onVmAction: (vmId: string, action: VmAction) => void;
  onAssignVm: (vmId: string) => void;
  onAssignTargetChange: (vmId: string, value: string) => void;
  onToggleHost: (hostKey: string, enabled: boolean) => void;
  onResetHostSecret: (hostKey: string) => void;
  onShowAgentInstallCommand: (host: HostRow) => void;
};

export function AdminDashboardPage(props: Props): JSX.Element {
  const hostColumns: TableColumnsType<HostRow> = [
    {
      title: "节点",
      key: "node",
      render: (_, host) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{host.name}</Typography.Text>
          <Typography.Text type="secondary">{host.hostKey}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "online",
      key: "online",
      render: (online: boolean) => <Tag color={online ? "green" : "default"}>{online ? "在线" : "离线"}</Tag>,
    },
    {
      title: "启用",
      dataIndex: "enabled",
      key: "enabled",
      render: (enabled: boolean) => <Tag color={enabled ? "cyan" : "red"}>{enabled ? "启用" : "停用"}</Tag>,
    },
    {
      title: "资源",
      key: "stats",
      render: (_, host) => {
        if (!host.stats) {
          return <Typography.Text type="secondary">暂无</Typography.Text>;
        }
        return (
          <Space direction="vertical" size={0}>
            <Typography.Text>
              CPU {host.stats.cpuUsagePercent.toFixed(1)}% / {host.stats.cpuCores}核
            </Typography.Text>
            <Typography.Text>
              内存 {host.stats.memoryUsedMb} / {host.stats.memoryTotalMb} MB
            </Typography.Text>
            <Typography.Text>
              磁盘 {host.stats.diskUsedGb} / {host.stats.diskTotalGb} GB
            </Typography.Text>
            <Typography.Text>
              网络 ↓{host.stats.networkRxMbps.toFixed(2)} ↑{host.stats.networkTxMbps.toFixed(2)} Mbps
            </Typography.Text>
          </Space>
        );
      },
    },
    {
      title: "操作",
      key: "actions",
      render: (_, host) => (
        <Space wrap>
          <Button size="small" onClick={() => props.onToggleHost(host.hostKey, !host.enabled)}>
            {host.enabled ? "停用" : "启用"}
          </Button>
          <Button size="small" onClick={() => props.onResetHostSecret(host.hostKey)}>
            重置密钥
          </Button>
          <Button size="small" onClick={() => props.onShowAgentInstallCommand(host)}>
            安装命令
          </Button>
        </Space>
      ),
    },
  ];

  const userColumns: TableColumnsType<UserRow> = [
    {
      title: "用户名",
      dataIndex: "username",
      key: "username",
    },
    {
      title: "角色",
      dataIndex: "role",
      key: "role",
      render: (role: Role) => <Tag color={role === "admin" ? "gold" : "blue"}>{role === "admin" ? "管理员" : "用户"}</Tag>,
    },
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      render: (value: string) => <Typography.Text code>{value}</Typography.Text>,
    },
    {
      title: "操作",
      key: "actions",
      render: (_, user) => (
        <Button size="small" onClick={() => props.onOpenEditUser(user)}>
          编辑用户
        </Button>
      ),
    },
  ];

  if (props.page === "overview") {
    const unassigned = props.vms.filter((vm) => vm.ownerUsername === "unassigned").length;
    const onlineHosts = props.hosts.filter((host) => host.online).length;
    return (
      <Row className="overview-row" gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="dashboard-panel overview-stat-card">
            <Statistic title="虚拟机总数" value={props.vms.length} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="dashboard-panel overview-stat-card">
            <Statistic title="未分配虚拟机" value={unassigned} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="dashboard-panel overview-stat-card">
            <Statistic title="宿主机节点" value={props.hosts.length} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="dashboard-panel overview-stat-card">
            <Statistic title="在线宿主机" value={onlineHosts} />
          </Card>
        </Col>
      </Row>
    );
  }

  if (props.page === "hosts") {
    return (
      <Card
        className="dashboard-panel"
        title="宿主机节点"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={props.onOpenCreateHost}>
            新增宿主机
          </Button>
        }
      >
        <Table
          className="dashboard-table"
          rowKey="hostKey"
          columns={hostColumns}
          dataSource={props.hosts}
          pagination={false}
          scroll={{ x: 1100 }}
        />
      </Card>
    );
  }

  if (props.page === "users") {
    return (
      <Card
        className="dashboard-panel"
        title="用户管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={props.onOpenCreateUser}>
            新增用户
          </Button>
        }
      >
        <Table
          className="dashboard-table"
          rowKey="id"
          columns={userColumns}
          dataSource={props.users}
          pagination={false}
          scroll={{ x: 900 }}
        />
      </Card>
    );
  }

  if (props.page === "settings") {
    return (
      <Card className="dashboard-panel" title="网站配置">
        <Form layout="vertical" className="settings-form">
          <Form.Item label="站点标题">
            <Input value={props.siteTitleInput} onChange={(event) => props.onSiteTitleInputChange(event.target.value)} />
          </Form.Item>
          <Form.Item label="登录页副标题">
            <Input value={props.loginSubtitleInput} onChange={(event) => props.onLoginSubtitleInputChange(event.target.value)} />
          </Form.Item>
          <Button type="primary" onClick={props.onSaveSiteConfig}>
            保存配置
          </Button>
        </Form>
      </Card>
    );
  }

  return (
    <Card
      className="dashboard-panel"
      title="虚拟机"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={props.onOpenCreateVm}>
          新建虚拟机
        </Button>
      }
    >
      <VmCardGrid
        vms={props.vms}
        adminMode
        currentUsername={props.currentUsername}
        assignTargets={props.assignTargets}
        onVmAction={props.onVmAction}
        onAssignVm={props.onAssignVm}
        onAssignTargetChange={props.onAssignTargetChange}
      />
    </Card>
  );
}
