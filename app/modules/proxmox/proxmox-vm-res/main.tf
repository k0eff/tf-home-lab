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
            file = each.value.clone != null ? "local-lvm:vm-${each.value.vmid}-disk-0" : null
          }
        }
        scsi1 {
          disk {
            size = "40G"
            storage = "local-lvm"
          }
        }
        scsi2 {
          disk {
            size = "45G"
            storage = "local-lvm"
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
