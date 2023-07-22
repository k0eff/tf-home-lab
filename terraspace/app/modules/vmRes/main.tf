data "vsphere_datacenter" "datacenter" {
  count = length(var.virtual_machines)
  name = var.virtual_machines[count.index].dcName
}

data "vsphere_datastore" "datastore" {
  count = length(var.virtual_machines)
  name = var.virtual_machines[count.index].datastore
  datacenter_id = data.vsphere_datacenter.datacenter[count.index].id
}

data "vsphere_resource_pool" "pool" {
  count = length(var.virtual_machines)
  name = var.virtual_machines[count.index].resource_pool
  datacenter_id = data.vsphere_datacenter.datacenter[count.index].id
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
      label          = "disk${disk.key}"
      size           = disk.value.size
      eagerly_scrub  = lookup(disk.value, "eagerly_scrub", false)
      thin_provisioned = lookup(disk.value, "thin_provisioned", true)
      datastore_id   = lookup(disk.value, "datastore_id", null)
    }
  }

  network_interface {
    network_id = var.virtual_machines[count.index].network_id
  }
}
