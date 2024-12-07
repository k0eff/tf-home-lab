output "vm_id" {
  value = module.vmData.*.id
}

output "guest_id" {
  value = module.vmData.*.guest_id
}

output "alternate_guest_name" {
  value = module.vmData.*.alternate_guest_name
}

output "annotation" {
  value = module.vmData.*.annotation
}

output "vm_num_cpus" {
  value = module.vmData.*.num_cpus
}

output "num_cores_per_socket" {
  value = module.vmData.*.num_cores_per_socket
}

output "vm_memory" {
  value = module.vmData.*.memory
}

output "disks" {
  value = module.vmData.*.disks
}

output "network_interfaces" {
  value = module.vmData.*.network_interfaces 
}

output "default_ip_address" {
  value = module.vmData.*.default_ip_address 
}

output "guest_ip_addresses" {
  value = module.vmData.*.guest_ip_addresses
}
