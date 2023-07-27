module "vms" {
  source = "../../modules/vmRes"
  virtual_machines = var.virtual_machines
}
