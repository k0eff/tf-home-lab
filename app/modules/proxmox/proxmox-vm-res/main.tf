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

  dynamic "disk" {
    for_each = flatten([ // 2d->1d array
      for d in [ // remove nulls
        each.value.clone != null ? {
          type        = "disk"
          disk_file   = "local-lvm:vm-${each.value.vmid}-disk-0"
          passthrough = true
          slot        = "scsi0"
          size = null
          storage = null
        } : null,
        [for disk_key, disk_value in each.value.disks : {
          type        = "disk"
          passthrough = false
          storage     = disk_value.storage
          slot        = disk_value.slot
          size        = disk_value.size
        }]
      ] : d if d != null
    ])

    content {
      type        = disk.value.type
      passthrough = disk.value.passthrough
      slot        = disk.value.slot
      storage     = lookup(disk.value, "storage", null)
      size        = lookup(disk.value, "size", null)
      disk_file   = lookup(disk.value, "disk_file", null)
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
