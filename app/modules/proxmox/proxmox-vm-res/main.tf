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
    onboot = each.value.onboot

  dynamic "disk" {
    for_each = flatten([ // 2d->1d array
      for d in [ // remove nulls
        each.value.clone != null ? [{
          type        = "disk"
          disk_file   = "local-lvm:vm-${each.value.vmid}-disk-0"
          passthrough = true
          slot        = "scsi0"
          size = null
          storage = null
        },
        {
          type = "cloudinit"
          storage = "local-lvm"
          passthrough = null
          slot = "sata0"
          size = null
          disk_file = null
        }
        ] : [],
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


  os_type = "ubuntu"
  boot = "order=scsi0"

  network {
    id = 0
    model = "virtio"
    bridge = "vmbr0"
    mtu = 1
  }
  agent = 1
  agent_timeout = 100
  skip_ipv6 = true
  qemu_os = "l26"
  numa = true
  
  
  ipconfig0 = each.value.ipconfig0
  ciuser = each.value.ciuser
  cipassword = each.value.cipassword


  lifecycle {
    ignore_changes = [ disk, ssh_host, ssh_port, default_ipv4_address, network["mtu"] ]
  }

}

terraform {
  required_providers {
    proxmox = {
      source  = "Telmate/proxmox"
      version = "3.0.1-rc6"
    }
  }
}
