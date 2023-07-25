output "vm_ids" {
  value = [for vm in vsphere_virtual_machine.vm : vm.id]
}

output "vm_ip_addresses" {
  value = [for vm in vsphere_virtual_machine.vm : vm.default_ip_address]
}
