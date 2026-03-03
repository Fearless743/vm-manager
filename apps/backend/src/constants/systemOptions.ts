import type { SystemOption } from "@vm-manager/shared";

export const systemOptions: SystemOption[] = [
  {
    id: "ubuntu-24-ssh",
    name: "Ubuntu 24.04 + SSH",
    image: "lscr.io/linuxserver/openssh-server:latest",
    description: "General Linux environment with SSH access"
  },
  {
    id: "debian-ssh",
    name: "Debian + SSH",
    image: "lscr.io/linuxserver/openssh-server:latest",
    description: "Debian-compatible SSH environment"
  },
  {
    id: "alpine-ssh",
    name: "Alpine + SSH",
    image: "lscr.io/linuxserver/openssh-server:latest",
    description: "Lightweight Linux environment with SSH"
  }
];
