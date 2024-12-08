provider "vsphere" {
  user                 = var.vsphere_user
  password             = var.vsphere_password
  vsphere_server       = var.vsphere_server
  allow_unverified_ssl = true
}

provider "proxmox" {
  pm_tls_insecure = true
  pm_user = var.proxmox_user
  pm_password = var.proxmox_pass
  pm_api_url = var.proxmox_api_url
  alias = "pm"
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



variable "proxmox_user" {
  type = string
  default = null
  sensitive = true
}
variable "proxmox_pass" {
  type = string
  default = null
  sensitive = true
}
variable "proxmox_api_url" {
  type = string
  default = null
  sensitive = true
}
