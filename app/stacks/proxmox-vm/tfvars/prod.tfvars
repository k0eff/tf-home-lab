proxmox_virtual_machines = {
    testvm1 = {
        name = "vm500"
        vmid = 500
        target_node = "proxmox"
        clone = "vm200"
        memory = 3072
        balloon = 1024
        sockets = 1
        cores = 1
        vcpus = 1
    }
}
