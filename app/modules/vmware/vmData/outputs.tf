
output "id" {
  value = data.vsphere_virtual_machine.vm.id
}

output "guest_id" {
  value = data.vsphere_virtual_machine.vm.guest_id
}

output "alternate_guest_name" {
  value = data.vsphere_virtual_machine.vm.alternate_guest_name
}

output "annotation" {
  value = data.vsphere_virtual_machine.vm.annotation
}

output "num_cpus" {
  value = data.vsphere_virtual_machine.vm.num_cpus
}

output "num_cores_per_socket" {
  value = data.vsphere_virtual_machine.vm.num_cores_per_socket
}

output "memory" {
  value = data.vsphere_virtual_machine.vm.memory
}

output "disks" {
  value = data.vsphere_virtual_machine.vm.disks
}

output "network_interfaces" {
  value = data.vsphere_virtual_machine.vm.network_interfaces 
}

output "default_ip_address" {
  value = data.vsphere_virtual_machine.vm.default_ip_address 
}

output "guest_ip_addresses" {
  value = data.vsphere_virtual_machine.vm.guest_ip_addresses
}
