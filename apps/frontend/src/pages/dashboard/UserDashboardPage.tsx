import { Card } from "antd";
import { VmCardGrid } from "../../components/vm/VmCardGrid";
import type { VmAction, VmRow } from "../../types";

type Props = {
  vms: VmRow[];
  username: string;
  onVmAction: (vmId: string, action: VmAction) => void;
};

export function UserDashboardPage(props: Props): JSX.Element {
  return (
    <Card title="我的虚拟机">
      <VmCardGrid
        vms={props.vms}
        adminMode={false}
        currentUsername={props.username}
        assignTargets={{}}
        onVmAction={props.onVmAction}
        onAssignVm={() => undefined}
        onAssignTargetChange={() => undefined}
      />
    </Card>
  );
}
