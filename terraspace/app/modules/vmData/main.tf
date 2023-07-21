data "vsphere_virtual_machine" "vm" {
  name          = var.name
  datacenter_id = var.datacenterId
}
