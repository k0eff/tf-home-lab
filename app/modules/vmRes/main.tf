
data "vsphere_datacenter" "datacenter" {
  for_each = var.virtual_machines
  name  = var.virtual_machines[each.key].dcName
}

data "vsphere_datastore" "datastore" {
  for_each = var.virtual_machines
  name  = var.virtual_machines[each.key].datastore
  datacenter_id = data.vsphere_datacenter.datacenter[each.key].id
}

data "vsphere_resource_pool" "pool" {
  for_each = var.virtual_machines
  name  = var.virtual_machines[each.key].resource_pool
  datacenter_id = data.vsphere_datacenter.datacenter[each.key].id
}

data "vsphere_network" "network" {
  for_each = var.virtual_machines
  name          = var.virtual_machines[each.key].network_id
  datacenter_id = data.vsphere_datacenter.datacenter[each.key].id
}

data "vsphere_virtual_machine" "cloneTemplate" {
  for_each = { for vm in var.virtual_machines : vm.name => vm if vm.clone != null || length(coalesce(vm.clone, {})) > 0 }
  name          = try(var.virtual_machines[each.key].clone.vmName, null)
  datacenter_id = try(var.virtual_machines[each.key].clone.vmName, null) != null ? data.vsphere_datacenter.datacenter[each.key].id : null
}

resource "vsphere_virtual_machine" "vm" {
  for_each = var.virtual_machines

  name                  = var.virtual_machines[each.key].name
  resource_pool_id      = data.vsphere_resource_pool.pool[each.key].id
  datastore_id          = data.vsphere_datastore.datastore[each.key].id
  num_cpus              = var.virtual_machines[each.key].num_cpus
  memory_limit          = var.virtual_machines[each.key].memory_limit
  memory                = var.virtual_machines[each.key].memory
  guest_id              = var.virtual_machines[each.key].guest_id
  ept_rvi_mode          = "automatic"
  hv_mode               = "hvAuto"
  enable_disk_uuid      = try(var.virtual_machines[each.key].enableDiskUUID, null)

  dynamic "disk" {
    for_each = var.virtual_machines[each.key].disk
    content {
      label          = "${var.virtual_machines[each.key].name}-disk${disk.key}"
      size           = disk.value.size
      eagerly_scrub  = lookup(disk.value, "eagerly_scrub", false)
      thin_provisioned = lookup(disk.value, "thin_provisioned", true)
      datastore_id   = lookup(disk.value, "datastore_id", data.vsphere_datastore.datastore[each.key].id)
    }
  }

  dynamic "cdrom" {
    for_each = try(var.virtual_machines[each.key].cdrom.datastore, null) != null || try(var.virtual_machines[each.key].cdrom.path, null) != null ? [1] : []
    content {
      datastore_id  = try(var.virtual_machines[each.key].cdrom.datastore, null)
      path          = try(var.virtual_machines[each.key].cdrom.path, null)
    }
  }

  network_interface {
    network_id = data.vsphere_network.network[each.key].id
  }

  dynamic "clone" {
    for_each = lookup(coalesce(var.virtual_machines[each.key].clone, {}), "vmName", null) != null ? [1] : []
    content {
      template_uuid = data.vsphere_virtual_machine.cloneTemplate[each.key].id
      customize {
        linux_options {
          host_name = try(var.virtual_machines[each.key].clone.hostname, null)
          domain = try(var.virtual_machines[each.key].clone.domain, null)
        }
        network_interface {
          ipv4_address = try(var.virtual_machines[each.key].clone.ipv4, null)
          ipv4_netmask = 24
        }
        ipv4_gateway = try(var.virtual_machines[each.key].clone.gw, null)
      }
    }
  }
  lifecycle {
    ignore_changes = [ 
      ept_rvi_mode,
      hv_mode,
      disk
     ]
  }
}
