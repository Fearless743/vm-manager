import { Button, Form, Input, Modal, Select, Typography } from "antd";
import type { Role } from "@vm-manager/shared";
import type { DashboardStore } from "../../stores/useDashboardStore";

type Props = {
  store: DashboardStore;
};

export function DashboardModals(props: Props): JSX.Element {
  const { store } = props;
  const activeUser = store.users.find((item) => item.id === store.activeUserId);

  return (
    <>
      <Modal
        open={store.modalKind === "createHost"}
        title="新增宿主机"
        onCancel={() => store.setModalKind(null)}
        onOk={() => void store.createHost()}
        okText="创建宿主机"
      >
        <Form layout="vertical">
          <Form.Item label="宿主机名称">
            <Input value={store.newHostName} onChange={(event) => store.setNewHostName(event.target.value)} />
          </Form.Item>
          <Form.Item label="节点密钥">
            <Input value="系统自动随机生成" disabled />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={store.modalKind === "createVm"}
        title="创建虚拟机"
        onCancel={() => store.setModalKind(null)}
        onOk={() => void store.createVm()}
        okText="创建虚拟机"
      >
        <Form layout="vertical">
          <Form.Item label="宿主机节点">
            <Select
              value={store.selectedHostKey || undefined}
              onChange={store.setSelectedHostKey}
              options={store.hosts
                .filter((host) => host.enabled)
                .map((host) => ({ value: host.hostKey, label: `${host.name} (${host.hostKey})` }))}
            />
          </Form.Item>
          <Form.Item label="系统选项">
            <Select
              value={store.selectedSystemId || undefined}
              onChange={store.setSelectedSystemId}
              options={store.systems.map((system) => ({ value: system.id, label: system.name }))}
            />
          </Form.Item>
          <Form.Item label="硬盘大小（GB，可选)">
            <Input value={store.diskSizeGbInput} onChange={(event) => store.setDiskSizeGbInput(event.target.value)} />
          </Form.Item>
          <Form.Item label="CPU 核心数（可选)">
            <Input value={store.cpuCoresInput} onChange={(event) => store.setCpuCoresInput(event.target.value)} />
          </Form.Item>
          <Form.Item label="内存（MB，可选)">
            <Input value={store.memoryMbInput} onChange={(event) => store.setMemoryMbInput(event.target.value)} />
          </Form.Item>
          <Form.Item label="带宽（Mbps，可选)">
            <Input value={store.bandwidthMbpsInput} onChange={(event) => store.setBandwidthMbpsInput(event.target.value)} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={store.modalKind === "createUser"}
        title="新增用户"
        onCancel={() => store.setModalKind(null)}
        onOk={() => void store.createUser()}
        okText="创建用户"
      >
        <Form layout="vertical">
          <Form.Item label="用户名">
            <Input value={store.newUserName} onChange={(event) => store.setNewUserName(event.target.value)} />
          </Form.Item>
          <Form.Item label="初始密码">
            <Input value={store.newUserPassword} onChange={(event) => store.setNewUserPassword(event.target.value)} />
          </Form.Item>
          <Form.Item label="角色">
            <Select
              value={store.newUserRole}
              onChange={(value) => store.setNewUserRole(value as Role)}
              options={[
                { value: "user", label: "用户" },
                { value: "admin", label: "管理员" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={store.modalKind === "editUser" && Boolean(activeUser)}
        title={activeUser ? `编辑用户：${activeUser.username}` : "编辑用户"}
        onCancel={() => store.setModalKind(null)}
        onOk={() => {
          if (activeUser) {
            void store.updateUser(activeUser.id);
          }
        }}
        okText="保存变更"
      >
        {activeUser && (
          <Form layout="vertical">
            <Form.Item label="角色">
              <Select
                value={store.userRoleTargets[activeUser.id] ?? activeUser.role}
                onChange={(value) => store.setUserRoleTargets((prev) => ({ ...prev, [activeUser.id]: value as Role }))}
                options={[
                  { value: "user", label: "用户" },
                  { value: "admin", label: "管理员" },
                ]}
              />
            </Form.Item>
            <Form.Item label="新密码（留空则不修改)">
              <Input
                value={store.userPasswordTargets[activeUser.id] ?? ""}
                onChange={(event) => store.setUserPasswordTargets((prev) => ({ ...prev, [activeUser.id]: event.target.value }))}
              />
            </Form.Item>
            <Button danger onClick={() => void store.deleteUser(activeUser.id)}>
              删除用户
            </Button>
          </Form>
        )}
      </Modal>

      <Modal
        open={store.modalKind === "showHostSecret"}
        title="节点密钥已重置"
        onCancel={() => store.setModalKind(null)}
        onOk={() => store.setModalKind(null)}
        okText="我已保存"
      >
        <Typography.Paragraph>
          请立即保存新的节点密钥，并更新宿主机 Agent 的 AGENT_SHARED_SECRET 后重启 Agent。
        </Typography.Paragraph>
        <Input readOnly value={store.rotatedHostSecret} />
      </Modal>

      <Modal
        open={store.modalKind === "showAgentInstallCommand"}
        title="Agent 一键安装命令"
        onCancel={() => store.setModalKind(null)}
        onOk={() => store.setModalKind(null)}
        okText="关闭"
      >
        <Typography.Paragraph>
          已自动填入当前面板域名与该宿主机节点密钥，可直接在目标宿主机执行。
        </Typography.Paragraph>
        <Input.TextArea value={store.agentInstallCommand} rows={6} readOnly />
        <Button
          style={{ marginTop: 12 }}
          onClick={() => {
            void navigator.clipboard.writeText(store.agentInstallCommand);
          }}
        >
          复制命令
        </Button>
      </Modal>

      <Modal
        open={store.modalKind === "changeOwnPassword"}
        title="修改密码"
        onCancel={() => store.setModalKind(null)}
        onOk={() => void store.changeOwnPassword()}
        okText="保存密码"
      >
        <Form layout="vertical">
          <Form.Item label="当前密码">
            <Input.Password
              value={store.currentPasswordInput}
              onChange={(event) => store.setCurrentPasswordInput(event.target.value)}
            />
          </Form.Item>
          <Form.Item label="新密码">
            <Input.Password value={store.newPasswordInput} onChange={(event) => store.setNewPasswordInput(event.target.value)} />
          </Form.Item>
          <Form.Item label="确认新密码">
            <Input.Password
              value={store.confirmPasswordInput}
              onChange={(event) => store.setConfirmPasswordInput(event.target.value)}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
