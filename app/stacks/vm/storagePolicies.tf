module "storagePolicies" {
  source   = "../../modules/vmRes"
  policies = var.storagePolicies
}
