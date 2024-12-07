module "vms" {
  source = "../../vmware/modules/vmRes"
  virtual_machines = var.virtual_machines
}
