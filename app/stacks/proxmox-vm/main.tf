module "proxmox_vm" {
  source = "../../modules/proxmox/proxmox-vm-res"
  proxmox_virtual_machines = var.proxmox_virtual_machines
  providers = {
    proxmox = proxmox.pm
  }
}
