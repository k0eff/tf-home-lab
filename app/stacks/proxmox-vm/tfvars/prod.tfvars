proxmox_virtual_machines = {
    testvm1 = {
        name = "vm500"
        vmid = 500
        target_node = "proxmox"
        clone = "VM 100"
        memory = 3072
        balloon = 1024
        sockets = 1
        cores = 1
        vcpus = 1
        disks = {
            scsi1 = {
                storage = "local-lvm"
                slot = "scsi1"
                size = "40G"
            }
            scsi2 = {
                storage = "local-lvm"
                slot = "scsi2"
                size = "45G"
            }
        }
    }
}
