provider "vsphere" {
  user                 = var.vsphere_user
  password             = var.vsphere_password
  vsphere_server       = var.vsphere_server
  allow_unverified_ssl = true
}

variable "vsphere_user" {
  type = string
  default = null
  sensitive = true
}
variable "vsphere_password" {
  type = string
  default = null
  sensitive = true
}
variable "vsphere_server" {
  type = string
  default = null
  sensitive = true
}