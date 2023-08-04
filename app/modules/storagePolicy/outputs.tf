
output "policyIds" {
  value = { for k, v in var.policies : k => resource.vsphere_vm_storage_policy.policy[k].id }
}
