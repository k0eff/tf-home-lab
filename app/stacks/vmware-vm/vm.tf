module "vms" {
  source = "../../vmware/modules/vmRes"
  virtual_machines = var.vmware_virtual_machines
}
