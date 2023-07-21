data "vsphere_datacenter" "datacenter" {
  name = "MiWiFi-R3600-srv"
}

data "vsphere_virtual_machine" "template" {
  name          = "vm10"
  datacenter_id = data.vsphere_datacenter.datacenter.id
}

output "vm_id" {
  value = data.vsphere_virtual_machine.template.id
}

output "guest_id" {
  value = data.vsphere_virtual_machine.template.guest_id
}

output "alternate_guest_name" {
  value = data.vsphere_virtual_machine.template.alternate_guest_name
}

output "annotation" {
  value = data.vsphere_virtual_machine.template.annotation
}

output "vm_num_cpus" {
  value = data.vsphere_virtual_machine.template.num_cpus
}

output "num_cores_per_socket" {
  value = data.vsphere_virtual_machine.template.num_cores_per_socket
}

output "vm_memory" {
  value = data.vsphere_virtual_machine.template.memory
}

output "disks" {
  value = data.vsphere_virtual_machine.template.disks
}

output "network_interfaces" {
  value = data.vsphere_virtual_machine.template.network_interfaces 
}

output "default_ip_address" {
  value = data.vsphere_virtual_machine.template.default_ip_address 
}

output "guest_ip_addresses" {
  value = data.vsphere_virtual_machine.template.guest_ip_addresses
}
