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

    // The provider default is the emulated LSI 53C895A. Under sustained
    // parallel I/O it times out and resets the SCSI bus — on 2026-08-16 vm700
    // logged "TARGET RESET operation timed-out" and "sym0: SCSI BUS has been
    // reset", after which the guest saw I/O errors on both its disks and ext4
    // aborted its journal. The NVMe underneath reported zero media errors the
    // whole time. virtio-scsi-single is the paravirtualised controller and is
    // built into the Ubuntu cloud kernel (CONFIG_SCSI_VIRTIO=y), so it needs
    // no initramfs work.
    scsihw = "virtio-scsi-single"

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

      // Proxmox defaults to aio=io_uring, which on LVM-thin under sustained
      // heavy writes threw sporadic EIO at the guest: on 2026-08-16 vm700's
      // 200 GB disk failed mid-build, ext4 aborted its journal and remounted
      // read-only, while the NVMe underneath reported SMART PASSED and the
      // failing sectors re-read fine afterwards. threads is the stable option
      // for this storage. Cloud-init drives take no such flag.
      //
      // Existing VMs are NOT reconciled from here — `disk` is in the
      // ignore_changes list below — so the same change was applied directly to
      // vm700 through the Proxmox API. This covers VMs created from now on.
      asyncio = disk.value.type == "disk" ? "threads" : null
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
