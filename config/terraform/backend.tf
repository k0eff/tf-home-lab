# This file was initially generated by terraspace_plugin_aws 0.6.1
# Backend Config Variables Docs
# https://terraspace.cloud/docs/config/backend/variables/

terraform {
  required_providers {
    vsphere = {
      source = "hashicorp/vsphere"
      version = "2.4.1"
    }

    proxmox = {
      source  = "Telmate/proxmox"
      version = "3.0.1-rc6"
    }
  }

  backend "local" {
    path = "<%= expansion('../../../../protected/state/:MOD_NAME/:ENV/terraform.tfstate') %>"
  }
}



