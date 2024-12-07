module "vmData" {
  source        = "../../modules/vmware/vmData"
  count         = length(var.options)
  name          = var.options[count.index].vmName
  datacenterId  = module.dcData[count.index].id
  tags          = var.options[count.index].tags
}

module "dcData" {
  source  = "../../modules/vmware/datacenterData"
  count   = length(var.options)
  name    = var.options[count.index].dcName
}
