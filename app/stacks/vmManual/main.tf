module "vmData" {
  source        = "../../modules/vmData"
  count         = length(var.options)
  name          = var.options[count.index].vmName
  datacenterId  = module.dcData[count.index].id
  tags          = var.options[count.index].tags
}

module "dcData" {
  source  = "../../modules/datacenterData"
  count   = length(var.options)
  name    = var.options[count.index].dcName
}
