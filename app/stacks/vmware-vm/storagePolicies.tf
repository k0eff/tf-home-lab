module "storagePolicies" {
  source   = "../../vmware/modules/storagePolicy"
  policies = var.storagePolicies
}
