package main

import (
	"bufio"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"
	"github.com/gorilla/websocket"
)

type Config struct {
	BackendWSURL       string
	AgentName          string
	Secret             string
	SSHContainerPort   int
	MinHostPort        int
	MaxHostPort        int
	ExtraOpenPortCount int
	SSHUsername        string
}

type BackendCommand struct {
	Type      string                 `json:"type"`
	RequestID string                 `json:"requestId"`
	VMID      string                 `json:"vmId"`
	Command   string                 `json:"command"`
	Payload   map[string]interface{} `json:"payload,omitempty"`
}

type AgentRegister struct {
	Type      string `json:"type"`
	AgentName string `json:"agentName"`
	Secret    string `json:"secret"`
}

type AgentHeartbeat struct {
	Type string `json:"type"`
	At   string `json:"at"`
}

type AgentResult struct {
	Type      string                 `json:"type"`
	RequestID string                 `json:"requestId"`
	OK        bool                   `json:"ok"`
	VMID      string                 `json:"vmId"`
	Payload   map[string]interface{} `json:"payload,omitempty"`
	Error     string                 `json:"error,omitempty"`
}

type HostStats struct {
	CPUCores        int     `json:"cpuCores"`
	CPUUsagePercent float64 `json:"cpuUsagePercent"`
	MemoryTotalMb   int     `json:"memoryTotalMb"`
	MemoryUsedMb    int     `json:"memoryUsedMb"`
	DiskTotalGb     int     `json:"diskTotalGb"`
	DiskUsedGb      int     `json:"diskUsedGb"`
	NetworkRxMbps   float64 `json:"networkRxMbps"`
	NetworkTxMbps   float64 `json:"networkTxMbps"`
}

type AgentStatus struct {
	Type      string    `json:"type"`
	AgentName string    `json:"agentName"`
	At        string    `json:"at"`
	Stats     HostStats `json:"stats"`
}

type Agent struct {
	conf   Config
	docker *client.Client
	mu     sync.Mutex
	conn   *websocket.Conn
	statMu sync.Mutex
	prev   struct {
		at        time.Time
		cpuTotal  uint64
		cpuIdle   uint64
		netRxByte uint64
		netTxByte uint64
	}
}

type VMResources struct {
	DiskSizeGb    int
	CPUCores      int
	MemoryMb      int
	BandwidthMbps int
}

func getEnv(name, fallback string) string {
	v := os.Getenv(name)
	if v == "" {
		return fallback
	}
	return v
}

func getEnvInt(name string, fallback int) int {
	raw := os.Getenv(name)
	if raw == "" {
		return fallback
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return v
}

func loadConfig() Config {
	conf := Config{
		BackendWSURL:       getEnv("BACKEND_WS_URL", "ws://localhost:4000/agent-ws"),
		AgentName:          getEnv("AGENT_NAME", "agent-go-local"),
		Secret:             getEnv("AGENT_SHARED_SECRET", "dev-agent-secret-change-me"),
		SSHContainerPort:   getEnvInt("SSH_CONTAINER_PORT", 2222),
		MinHostPort:        getEnvInt("MIN_HOST_PORT", 20000),
		MaxHostPort:        getEnvInt("MAX_HOST_PORT", 60000),
		ExtraOpenPortCount: getEnvInt("EXTRA_OPEN_PORT_COUNT", 100),
		SSHUsername:        getEnv("SSH_USERNAME", "vmuser"),
	}
	validUser := regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
	if !validUser.MatchString(conf.SSHUsername) {
		conf.SSHUsername = "vmuser"
	}
	return conf
}

func randomPassword() (string, error) {
	b := make([]byte, 12)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func isPortAvailable(port int) bool {
	ln, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
	if err != nil {
		return false
	}
	_ = ln.Close()
	return true
}

func allocatePorts(count int, minPort int, maxPort int, reserved map[int]bool) ([]int, error) {
	ports := make([]int, 0, count)
	for port := minPort; port <= maxPort && len(ports) < count; port++ {
		if reserved[port] {
			continue
		}
		if isPortAvailable(port) {
			ports = append(ports, port)
			reserved[port] = true
		}
	}
	if len(ports) != count {
		return nil, fmt.Errorf("unable to allocate %d host ports", count)
	}
	return ports, nil
}

func allocateSpecificPorts(ports []int, minPort int, maxPort int, reserved map[int]bool) ([]int, error) {
	allocated := make([]int, 0, len(ports))
	for _, port := range ports {
		if port < minPort || port > maxPort {
			return nil, fmt.Errorf("requested port out of range: %d", port)
		}
		if reserved[port] {
			return nil, fmt.Errorf("requested port is duplicated: %d", port)
		}
		if !isPortAvailable(port) {
			return nil, fmt.Errorf("requested port unavailable: %d", port)
		}
		allocated = append(allocated, port)
		reserved[port] = true
	}
	return allocated, nil
}

func readCPUSample() (total uint64, idle uint64, err error) {
	f, err := os.Open("/proc/stat")
	if err != nil {
		return 0, 0, err
	}
	defer f.Close()

	s := bufio.NewScanner(f)
	if !s.Scan() {
		return 0, 0, errors.New("cpu stat empty")
	}
	parts := strings.Fields(s.Text())
	if len(parts) < 5 || parts[0] != "cpu" {
		return 0, 0, errors.New("cpu stat invalid")
	}
	vals := make([]uint64, 0, len(parts)-1)
	for _, p := range parts[1:] {
		v, convErr := strconv.ParseUint(p, 10, 64)
		if convErr != nil {
			return 0, 0, convErr
		}
		vals = append(vals, v)
		total += v
	}
	idle = vals[3]
	if len(vals) > 4 {
		idle += vals[4]
	}
	return total, idle, nil
}

func readMemSample() (totalMb int, usedMb int, err error) {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return 0, 0, err
	}
	defer f.Close()

	var memTotalKb uint64
	var memAvailKb uint64
	s := bufio.NewScanner(f)
	for s.Scan() {
		line := s.Text()
		if strings.HasPrefix(line, "MemTotal:") {
			parts := strings.Fields(line)
			v, convErr := strconv.ParseUint(parts[1], 10, 64)
			if convErr == nil {
				memTotalKb = v
			}
		}
		if strings.HasPrefix(line, "MemAvailable:") {
			parts := strings.Fields(line)
			v, convErr := strconv.ParseUint(parts[1], 10, 64)
			if convErr == nil {
				memAvailKb = v
			}
		}
	}
	if memTotalKb == 0 {
		return 0, 0, errors.New("mem total unavailable")
	}
	totalMb = int(memTotalKb / 1024)
	usedMb = int((memTotalKb - memAvailKb) / 1024)
	return totalMb, usedMb, nil
}

func readDiskSample() (totalGb int, usedGb int, err error) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs("/", &stat); err != nil {
		return 0, 0, err
	}
	total := stat.Blocks * uint64(stat.Bsize)
	available := stat.Bavail * uint64(stat.Bsize)
	used := total - available
	totalGb = int(total / (1024 * 1024 * 1024))
	usedGb = int(used / (1024 * 1024 * 1024))
	return totalGb, usedGb, nil
}

func readNetworkTotals() (rxBytes uint64, txBytes uint64, err error) {
	f, err := os.Open("/proc/net/dev")
	if err != nil {
		return 0, 0, err
	}
	defer f.Close()

	s := bufio.NewScanner(f)
	lineNo := 0
	for s.Scan() {
		lineNo++
		if lineNo <= 2 {
			continue
		}
		line := strings.TrimSpace(s.Text())
		parts := strings.Split(line, ":")
		if len(parts) != 2 {
			continue
		}
		iface := strings.TrimSpace(parts[0])
		if iface == "lo" {
			continue
		}
		fields := strings.Fields(parts[1])
		if len(fields) < 16 {
			continue
		}
		rx, rxErr := strconv.ParseUint(fields[0], 10, 64)
		tx, txErr := strconv.ParseUint(fields[8], 10, 64)
		if rxErr == nil {
			rxBytes += rx
		}
		if txErr == nil {
			txBytes += tx
		}
	}
	return rxBytes, txBytes, nil
}

func (a *Agent) collectHostStats() (HostStats, error) {
	cpuTotal, cpuIdle, err := readCPUSample()
	if err != nil {
		return HostStats{}, err
	}
	memTotal, memUsed, err := readMemSample()
	if err != nil {
		return HostStats{}, err
	}
	diskTotal, diskUsed, err := readDiskSample()
	if err != nil {
		return HostStats{}, err
	}
	netRx, netTx, err := readNetworkTotals()
	if err != nil {
		return HostStats{}, err
	}

	now := time.Now()
	a.statMu.Lock()
	prev := a.prev
	a.prev.at = now
	a.prev.cpuTotal = cpuTotal
	a.prev.cpuIdle = cpuIdle
	a.prev.netRxByte = netRx
	a.prev.netTxByte = netTx
	a.statMu.Unlock()

	cpuUsage := 0.0
	rxMbps := 0.0
	txMbps := 0.0
	if !prev.at.IsZero() {
		totalDelta := float64(cpuTotal - prev.cpuTotal)
		idleDelta := float64(cpuIdle - prev.cpuIdle)
		if totalDelta > 0 {
			cpuUsage = ((totalDelta - idleDelta) / totalDelta) * 100
		}
		seconds := now.Sub(prev.at).Seconds()
		if seconds > 0 {
			rxMbps = float64(netRx-prev.netRxByte) * 8 / seconds / 1_000_000
			txMbps = float64(netTx-prev.netTxByte) * 8 / seconds / 1_000_000
		}
	}

	return HostStats{
		CPUCores:        runtime.NumCPU(),
		CPUUsagePercent: cpuUsage,
		MemoryTotalMb:   memTotal,
		MemoryUsedMb:    memUsed,
		DiskTotalGb:     diskTotal,
		DiskUsedGb:      diskUsed,
		NetworkRxMbps:   rxMbps,
		NetworkTxMbps:   txMbps,
	}, nil
}

func getString(payload map[string]interface{}, key string) (string, bool) {
	if payload == nil {
		return "", false
	}
	v, ok := payload[key]
	if !ok {
		return "", false
	}
	s, ok := v.(string)
	if !ok {
		return "", false
	}
	if strings.TrimSpace(s) == "" {
		return "", false
	}
	return s, true
}

func getInt(payload map[string]interface{}, key string) (int, bool) {
	if payload == nil {
		return 0, false
	}
	v, ok := payload[key]
	if !ok {
		return 0, false
	}
	switch n := v.(type) {
	case float64:
		return int(n), true
	case int:
		return n, true
	case int64:
		return int(n), true
	default:
		return 0, false
	}
}

func getIntSlice(payload map[string]interface{}, key string) ([]int, bool) {
	if payload == nil {
		return nil, false
	}
	v, ok := payload[key]
	if !ok {
		return nil, false
	}
	arr, ok := v.([]interface{})
	if !ok {
		return nil, false
	}
	out := make([]int, 0, len(arr))
	for _, item := range arr {
		n, ok := item.(float64)
		if !ok {
			return nil, false
		}
		out = append(out, int(n))
	}
	return out, true
}

func (a *Agent) sendJSON(v interface{}) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.conn == nil {
		return errors.New("websocket is not connected")
	}
	return a.conn.WriteJSON(v)
}

func (a *Agent) ensureImage(ctx context.Context, imageName string) error {
	_, _, err := a.docker.ImageInspectWithRaw(ctx, imageName)
	if err == nil {
		return nil
	}
	r, err := a.docker.ImagePull(ctx, imageName, image.PullOptions{})
	if err != nil {
		return err
	}
	defer r.Close()
	_, _ = io.Copy(io.Discard, r)
	return nil
}

func resourcesFromPayload(payload map[string]interface{}) VMResources {
	res := VMResources{}
	if v, ok := getInt(payload, "diskSizeGb"); ok && v > 0 {
		res.DiskSizeGb = v
	}
	if v, ok := getInt(payload, "cpuCores"); ok && v > 0 {
		res.CPUCores = v
	}
	if v, ok := getInt(payload, "memoryMb"); ok && v > 0 {
		res.MemoryMb = v
	}
	if v, ok := getInt(payload, "bandwidthMbps"); ok && v > 0 {
		res.BandwidthMbps = v
	}
	return res
}

func (a *Agent) createVM(ctx context.Context, vmID string, imageName string, requestedSSHPort *int, requestedOpenPorts []int, resources VMResources) (map[string]interface{}, error) {
	if err := a.ensureImage(ctx, imageName); err != nil {
		return nil, err
	}

	password, err := randomPassword()
	if err != nil {
		return nil, err
	}

	reserved := map[int]bool{}
	sshPort := 0
	if requestedSSHPort != nil {
		ports, allocErr := allocateSpecificPorts([]int{*requestedSSHPort}, a.conf.MinHostPort, a.conf.MaxHostPort, reserved)
		if allocErr != nil {
			return nil, allocErr
		}
		sshPort = ports[0]
	} else {
		sshPorts, allocErr := allocatePorts(1, a.conf.MinHostPort, a.conf.MaxHostPort, reserved)
		if allocErr != nil {
			return nil, allocErr
		}
		sshPort = sshPorts[0]
	}
	openPorts := make([]int, 0)
	if len(requestedOpenPorts) > 0 {
		ports, allocErr := allocateSpecificPorts(requestedOpenPorts, a.conf.MinHostPort, a.conf.MaxHostPort, reserved)
		if allocErr != nil {
			return nil, allocErr
		}
		openPorts = ports
	} else {
		ports, allocErr := allocatePorts(a.conf.ExtraOpenPortCount, a.conf.MinHostPort, a.conf.MaxHostPort, reserved)
		if allocErr != nil {
			return nil, allocErr
		}
		openPorts = ports
	}

	portSet := nat.PortSet{}
	portMap := nat.PortMap{}
	sshContainerPort := nat.Port(fmt.Sprintf("%d/tcp", a.conf.SSHContainerPort))
	portSet[sshContainerPort] = struct{}{}
	portMap[sshContainerPort] = []nat.PortBinding{{HostIP: "0.0.0.0", HostPort: strconv.Itoa(sshPort)}}

	for _, hostPort := range openPorts {
		p := nat.Port(fmt.Sprintf("%d/tcp", hostPort))
		portSet[p] = struct{}{}
		portMap[p] = []nat.PortBinding{{HostIP: "0.0.0.0", HostPort: strconv.Itoa(hostPort)}}
	}

	cfg := &container.Config{
		Image: imageName,
		Env: []string{
			"PASSWORD_ACCESS=true",
			"SUDO_ACCESS=false",
			fmt.Sprintf("USER_NAME=%s", a.conf.SSHUsername),
			fmt.Sprintf("USER_PASSWORD=%s", password),
		},
		ExposedPorts: portSet,
		Labels: map[string]string{
			"lxc-manager.managed":       "true",
			"lxc-manager.vmId":          vmID,
			"lxc-manager.bandwidthMbps": strconv.Itoa(resources.BandwidthMbps),
		},
	}
	hostCfg := &container.HostConfig{
		PortBindings: portMap,
		RestartPolicy: container.RestartPolicy{
			Name: "unless-stopped",
		},
	}
	if resources.CPUCores > 0 {
		hostCfg.NanoCPUs = int64(resources.CPUCores) * 1_000_000_000
	}
	if resources.MemoryMb > 0 {
		hostCfg.Memory = int64(resources.MemoryMb) * 1024 * 1024
	}
	if resources.DiskSizeGb > 0 {
		hostCfg.StorageOpt = map[string]string{"size": fmt.Sprintf("%dg", resources.DiskSizeGb)}
	}
	resp, err := a.docker.ContainerCreate(ctx, cfg, hostCfg, &network.NetworkingConfig{}, nil, "vm-"+vmID)
	if err != nil {
		return nil, err
	}

	if err := a.docker.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"containerId":   resp.ID,
		"sshPassword":   password,
		"sshPort":       sshPort,
		"openPorts":     openPorts,
		"sshUsername":   a.conf.SSHUsername,
		"diskSizeGb":    resources.DiskSizeGb,
		"cpuCores":      resources.CPUCores,
		"memoryMb":      resources.MemoryMb,
		"bandwidthMbps": resources.BandwidthMbps,
	}, nil
}

func (a *Agent) findContainerIDByVMID(ctx context.Context, vmID string) (string, error) {
	f := filters.NewArgs()
	f.Add("label", "lxc-manager.vmId="+vmID)
	f.Add("label", "lxc-manager.managed=true")
	containers, err := a.docker.ContainerList(ctx, container.ListOptions{All: true, Filters: f})
	if err != nil {
		return "", err
	}
	if len(containers) == 0 {
		return "", errors.New("container not found")
	}
	return containers[0].ID, nil
}

func (a *Agent) commandContainerID(ctx context.Context, vmID string, payload map[string]interface{}) (string, error) {
	_ = payload
	return a.findContainerIDByVMID(ctx, vmID)
}

func (a *Agent) handleCommand(cmd BackendCommand) AgentResult {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	out := AgentResult{Type: "agent.result", RequestID: cmd.RequestID, VMID: cmd.VMID, OK: false}

	switch cmd.Command {
	case "create":
		imageName := "lscr.io/linuxserver/openssh-server:latest"
		if v, ok := getString(cmd.Payload, "image"); ok {
			imageName = v
		}
		resources := resourcesFromPayload(cmd.Payload)
		payload, err := a.createVM(ctx, cmd.VMID, imageName, nil, nil, resources)
		if err != nil {
			out.Error = err.Error()
			return out
		}
		out.OK = true
		out.Payload = payload
		return out
	case "start":
		id, err := a.commandContainerID(ctx, cmd.VMID, cmd.Payload)
		if err != nil {
			out.Error = err.Error()
			return out
		}
		err = a.docker.ContainerStart(ctx, id, container.StartOptions{})
		if err != nil {
			out.Error = err.Error()
			return out
		}
		out.OK = true
		return out
	case "stop":
		id, err := a.commandContainerID(ctx, cmd.VMID, cmd.Payload)
		if err != nil {
			out.Error = err.Error()
			return out
		}
		timeout := 10
		err = a.docker.ContainerStop(ctx, id, container.StopOptions{Timeout: &timeout})
		if err != nil {
			out.Error = err.Error()
			return out
		}
		out.OK = true
		return out
	case "reboot":
		id, err := a.commandContainerID(ctx, cmd.VMID, cmd.Payload)
		if err != nil {
			out.Error = err.Error()
			return out
		}
		timeout := 10
		err = a.docker.ContainerRestart(ctx, id, container.StopOptions{Timeout: &timeout})
		if err != nil {
			out.Error = err.Error()
			return out
		}
		out.OK = true
		return out
	case "reinstall":
		id, err := a.commandContainerID(ctx, cmd.VMID, cmd.Payload)
		if err != nil {
			out.Error = err.Error()
			return out
		}
		timeout := 5
		err = a.docker.ContainerStop(ctx, id, container.StopOptions{Timeout: &timeout})
		if err != nil && !strings.Contains(strings.ToLower(err.Error()), "is not running") {
			out.Error = err.Error()
			return out
		}
		err = a.docker.ContainerRemove(ctx, id, container.RemoveOptions{Force: true})
		if err != nil {
			out.Error = err.Error()
			return out
		}
		imageName := "lscr.io/linuxserver/openssh-server:latest"
		if v, ok := getString(cmd.Payload, "image"); ok {
			imageName = v
		}
		var requestedSSHPort *int
		if sshPort, ok := getInt(cmd.Payload, "sshPort"); ok {
			requestedSSHPort = &sshPort
		}
		requestedOpenPorts := []int{}
		if arr, ok := getIntSlice(cmd.Payload, "openPorts"); ok {
			requestedOpenPorts = arr
		}
		resources := resourcesFromPayload(cmd.Payload)
		payload, createErr := a.createVM(ctx, cmd.VMID, imageName, requestedSSHPort, requestedOpenPorts, resources)
		if createErr != nil {
			out.Error = createErr.Error()
			return out
		}
		out.OK = true
		out.Payload = payload
		return out
	case "resetPassword":
		id, err := a.commandContainerID(ctx, cmd.VMID, cmd.Payload)
		if err != nil {
			out.Error = err.Error()
			return out
		}
		newPassword, err := randomPassword()
		if err != nil {
			out.Error = err.Error()
			return out
		}
		cmdText := fmt.Sprintf("echo '%s:%s' | chpasswd", a.conf.SSHUsername, newPassword)
		execResp, err := a.docker.ContainerExecCreate(ctx, id, container.ExecOptions{
			AttachStdout: true,
			AttachStderr: true,
			Cmd:          []string{"sh", "-lc", cmdText},
			User:         "root",
		})
		if err != nil {
			out.Error = err.Error()
			return out
		}
		attach, err := a.docker.ContainerExecAttach(ctx, execResp.ID, container.ExecStartOptions{})
		if err != nil {
			out.Error = err.Error()
			return out
		}
		_, _ = io.Copy(io.Discard, attach.Reader)
		attach.Close()
		execInspect, err := a.docker.ContainerExecInspect(ctx, execResp.ID)
		if err != nil {
			out.Error = err.Error()
			return out
		}
		if execInspect.ExitCode != 0 {
			out.Error = "failed to reset ssh password"
			return out
		}
		out.OK = true
		out.Payload = map[string]interface{}{"sshPassword": newPassword}
		return out
	case "delete":
		id, err := a.commandContainerID(ctx, cmd.VMID, cmd.Payload)
		if err != nil {
			out.Error = err.Error()
			return out
		}
		timeout := 5
		err = a.docker.ContainerStop(ctx, id, container.StopOptions{Timeout: &timeout})
		if err != nil && !strings.Contains(strings.ToLower(err.Error()), "is not running") {
			out.Error = err.Error()
			return out
		}
		err = a.docker.ContainerRemove(ctx, id, container.RemoveOptions{Force: true})
		if err != nil {
			out.Error = err.Error()
			return out
		}
		out.OK = true
		return out
	default:
		out.Error = "unsupported command: " + cmd.Command
		return out
	}
}

func (a *Agent) connectAndServe() {
	for {
		conn, _, err := websocket.DefaultDialer.Dial(a.conf.BackendWSURL, http.Header{})
		if err != nil {
			log.Printf("dial failed: %v", err)
			time.Sleep(2 * time.Second)
			continue
		}

		a.mu.Lock()
		a.conn = conn
		a.mu.Unlock()

		register := AgentRegister{
			Type:      "agent.register",
			AgentName: a.conf.AgentName,
			Secret:    a.conf.Secret,
		}
		if err := a.sendJSON(register); err != nil {
			_ = conn.Close()
			time.Sleep(2 * time.Second)
			continue
		}

		done := make(chan struct{})
		go func() {
			ticker := time.NewTicker(5 * time.Second)
			defer ticker.Stop()
			heartbeatCounter := 0
			for {
				select {
				case <-done:
					return
				case <-ticker.C:
					heartbeatCounter++
					now := time.Now().UTC().Format(time.RFC3339)
					if heartbeatCounter%3 == 0 {
						_ = a.sendJSON(AgentHeartbeat{Type: "agent.heartbeat", At: now})
					}
					stats, statsErr := a.collectHostStats()
					if statsErr == nil {
						_ = a.sendJSON(AgentStatus{Type: "agent.status", AgentName: a.conf.AgentName, At: now, Stats: stats})
					}
				}
			}
		}()

		for {
			_, data, err := conn.ReadMessage()
			if err != nil {
				close(done)
				break
			}

			var cmd BackendCommand
			if err := json.Unmarshal(data, &cmd); err != nil {
				continue
			}
			if cmd.Type != "backend.command" {
				continue
			}

			result := a.handleCommand(cmd)
			if err := a.sendJSON(result); err != nil {
				close(done)
				break
			}
		}

		a.mu.Lock()
		a.conn = nil
		a.mu.Unlock()
		_ = conn.Close()
		time.Sleep(2 * time.Second)
	}
}

func main() {
	conf := loadConfig()
	dockerClient, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		log.Fatalf("docker client init failed: %v", err)
	}
	agent := &Agent{conf: conf, docker: dockerClient}
	log.Printf("agent(go) started, backend=%s", conf.BackendWSURL)
	agent.connectAndServe()
}
