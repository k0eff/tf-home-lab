module "storagePolicies" {
  source   = "../../vmware/modules/storagePolicy"
  policies = var.vmware_storagePolicies
}
