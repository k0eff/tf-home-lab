output "vmIPs" {
    value = { for vm_key, vm in proxmox_vm_qemu.proxmox_vm : vm_key => vm.default_ipv4_address }
}
