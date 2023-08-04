module "storagePolicies" {
  source   = "../../modules/storagePolicy"
  policies = var.storagePolicies
}
