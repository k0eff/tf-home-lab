
output "policyIds" {
    value = { for each in var.policies : each.key => resource.vsphere_vm_storage_policy.policies[each.key].id }
}