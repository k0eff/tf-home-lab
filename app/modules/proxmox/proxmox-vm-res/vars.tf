variable "proxmox_virtual_machines" {
    type = map(object({
      name = string
      vmid = string
      target_node = string
      clone = string
      memory = number
      balloon = number
      sockets = number
      cores = number
      vcpus = number
      ipconfig0 = string
      ciuser = string
      cipassword = string
      disks = map(object({
        storage = string
        slot = string
        size = string
      }))
    #   cpu_type = string
    }))
}