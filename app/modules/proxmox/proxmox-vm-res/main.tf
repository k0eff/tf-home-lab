resource "proxmox_vm_qemu" "proxmox_vm" {
    for_each = var.proxmox_virtual_machines

    name = each.value.name
    vmid = each.value.vmid
    target_node = each.value.target_node
    clone = each.value.clone
    memory = each.value.memory
    balloon = each.value.balloon
    sockets = each.value.sockets
    cores = each.value.cores
    vcpus = each.value.vcpus
    cpu_type = "host"
    vm_state = "started"

    disks {
      scsi {
        scsi0 {
          passthrough {
            file = "local-lvm:vm-500-disk-0"
          }
        }
      }
    }

    boot = "order=scsi0"

}

terraform {
  required_providers {
    proxmox = {
      source  = "Telmate/proxmox"
      version = "3.0.1-rc6"
    }
  }
}
