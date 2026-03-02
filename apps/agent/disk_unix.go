//go:build !windows

package main

import "syscall"

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
