// TODO: change all of these to a map of objects and use for_each
// TODO: use module instead of data? (will require exporting all vars)

data "vsphere_datacenter" "datacenter" {
  count = length(var.virtual_machines)
  name  = var.virtual_machines[count.index].dcName
}

data "vsphere_datastore" "datastore" {
  count = length(var.virtual_machines)
  name  = var.virtual_machines[count.index].datastore
  datacenter_id = data.vsphere_datacenter.datacenter[count.index].id
}

data "vsphere_resource_pool" "pool" {
  count = length(var.virtual_machines)
  name  = var.virtual_machines[count.index].resource_pool
  datacenter_id = data.vsphere_datacenter.datacenter[count.index].id
}

data "vsphere_network" "network" {
  count = length(var.virtual_machines)
  name          = var.virtual_machines[count.index].network_id
  datacenter_id = data.vsphere_datacenter.datacenter[count.index].id
}

data "vsphere_virtual_machine" "cloneTemplate" {
  count = length(var.virtual_machines)
  name          = try(var.virtual_machines[count.index].clone.vmName, null)
  datacenter_id = try(var.virtual_machines[count.index].clone.vmName, null) != null ? data.vsphere_datacenter.datacenter[count.index].id : null
}




resource "vsphere_virtual_machine" "vm" {
  count = length(var.virtual_machines)

  name                  = var.virtual_machines[count.index].name
  resource_pool_id      = data.vsphere_resource_pool.pool[count.index].id
  datastore_id          = data.vsphere_datastore.datastore[count.index].id
  num_cpus              = var.virtual_machines[count.index].num_cpus
  memory_limit          = var.virtual_machines[count.index].memory
  guest_id              = var.virtual_machines[count.index].guest_id

  dynamic "disk" {
    for_each = var.virtual_machines[count.index].disk
    content {
      label          = "${var.virtual_machines[count.index].name}-disk${disk.key}"
      size           = disk.value.size
      eagerly_scrub  = lookup(disk.value, "eagerly_scrub", false)
      thin_provisioned = lookup(disk.value, "thin_provisioned", true)
      datastore_id   = lookup(disk.value, "datastore_id", null)
    }
  }

  cdrom {
    datastore_id  = try(var.virtual_machines[count.index].cdrom.datastore, null)
    path          = try(var.virtual_machines[count.index].cdrom.path)
  }

  network_interface {
    network_id = data.vsphere_network.network[count.index].id
  }

  dynamic "clone" {
    for_each = var.virtual_machines
    content {
      template_uuid = data.cloneTemplate[count.index].id
      customize {
        linux_options {
          host_name = try(var.virtual_machines[count.index].clone.hostname, null)
          domain = try(var.virtual_machines[count.index].clone.domain, null)
        }
        network_interface {
          ipv4_address = try(var.virtual_machines[count.index].clone.ipv4, null)
          ipv4_netmask = 24
        }
        ipv4_gateway = try(var.virtual_machines[count.index].clone.gw, null)
      }
    }
  }
}
