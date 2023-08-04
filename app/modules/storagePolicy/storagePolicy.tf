data "vsphere_datacenter" "datacenter" {
  for_each = var.policies
  name     = var.policies[each.key].dcName
}

resource "vsphere_vm_storage_policy" "policies" {
  for_each    = var.policies
  name        = var.policies[each.key].name
  description = var.policies[each.key].description

  dynamic "tag_rules" {
    for_each = var.policies[each.key].tagRules
    content {
      tag_category                 = tag_rules.value["tagCategoryName"]
      tags                         = tag_rules.value["tags"]
      include_datastores_with_tags = tag_rules.value["inclDsTags"]
    }
  }
}
