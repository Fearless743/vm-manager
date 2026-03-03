import { Alert, Button, Card, Input, Space, Tag, Typography } from "antd";
import type { VmAction, VmRow } from "../../types";

const statusColor = (status: string): string => {
  if (status === "running") return "green";
  if (status === "stopped") return "default";
  if (status === "creating") return "gold";
  if (status === "deleted") return "geekblue";
  if (status === "error") return "red";
  return "cyan";
};

const statusLabel = (status: string): string => {
  if (status === "running") return "运行中";
  if (status === "stopped") return "已关机";
  if (status === "creating") return "创建中";
  if (status === "deleted") return "已删除";
  if (status === "error") return "异常";
  return status;
};

type Props = {
  vms: VmRow[];
  adminMode: boolean;
  currentUsername: string;
  assignTargets: Record<string, string>;
  onAssignTargetChange: (vmId: string, value: string) => void;
  onVmAction: (vmId: string, action: VmAction) => void;
  onAssignVm: (vmId: string) => void;
};

export function VmCardGrid(props: Props): JSX.Element {
  const filtered = props.adminMode ? props.vms : props.vms.filter((vm) => vm.ownerUsername === props.currentUsername);

  return (
    <div className="vm-grid">
      {filtered.map((vm) => (
        <Card
          className="vm-card"
          key={vm.id}
          title={
            <Space>
              <Typography.Text strong>{vm.id.slice(0, 8)}</Typography.Text>
              <Tag color={statusColor(vm.status)}>{statusLabel(vm.status)}</Tag>
            </Space>
          }
        >
          <Space direction="vertical" size={2} style={{ width: "100%" }}>
            <Typography.Text>归属用户: {vm.ownerUsername}</Typography.Text>
            <Typography.Text>宿主机: {vm.hostKey}</Typography.Text>
            <Typography.Text>系统: {vm.systemId}</Typography.Text>
            <Typography.Text>硬盘: {vm.diskSizeGb ? `${vm.diskSizeGb} GB` : "默认"}</Typography.Text>
            <Typography.Text>CPU 核心: {vm.cpuCores ?? "默认"}</Typography.Text>
            <Typography.Text>内存: {vm.memoryMb ? `${vm.memoryMb} MB` : "默认"}</Typography.Text>
            <Typography.Text>带宽: {vm.bandwidthMbps ? `${vm.bandwidthMbps} Mbps` : "默认"}</Typography.Text>
            <Typography.Text>SSH 端口: {vm.sshPort ?? "-"}</Typography.Text>
            <Typography.Text>SSH 密码: {vm.sshPassword ?? "-"}</Typography.Text>
            <Typography.Text>开放端口: {vm.openPorts.length ? vm.openPorts.join(", ") : "-"}</Typography.Text>
            {vm.lastError && <Alert type="error" showIcon message={vm.lastError} />}
          </Space>

          <Space wrap size={[8, 8]} className="vm-action-row">
            <Button size="small" onClick={() => props.onVmAction(vm.id, "start")}>开机</Button>
            <Button size="small" onClick={() => props.onVmAction(vm.id, "stop")}>关机</Button>
            <Button size="small" onClick={() => props.onVmAction(vm.id, "reboot")}>重启</Button>
            <Button size="small" onClick={() => props.onVmAction(vm.id, "reinstall")}>重装系统</Button>
            <Button size="small" onClick={() => props.onVmAction(vm.id, "resetPassword")}>重置密码</Button>
            {props.adminMode && (
              <Button size="small" danger onClick={() => props.onVmAction(vm.id, "delete")}>删除</Button>
            )}
          </Space>

          {props.adminMode && (
            <Space.Compact style={{ width: "100%", marginTop: 10 }}>
              <Input
                placeholder="分配给用户名"
                value={props.assignTargets[vm.id] ?? (vm.ownerUsername === "unassigned" ? "" : vm.ownerUsername)}
                onChange={(event) => props.onAssignTargetChange(vm.id, event.target.value)}
              />
              <Button type="primary" onClick={() => props.onAssignVm(vm.id)}>分配</Button>
            </Space.Compact>
          )}
        </Card>
      ))}
    </div>
  );
}
