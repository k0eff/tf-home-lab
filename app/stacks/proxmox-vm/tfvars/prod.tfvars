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
        ipconfig0 = "ip=192.168.31.189/24,gw=192.168.31.1"
        ciuser = "<%= ENV['linux_user'] %>"
        cipassword = "<%= ENV['linux_password'] %>"
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
    testvm2 = {
        name = "vm600"
        vmid = 600
        target_node = "proxmox"
        clone = "vm200"
        memory = 3072
        balloon = 1024
        sockets = 1
        cores = 1
        vcpus = 1
        ipconfig0 = "ip=192.168.31.188/24,gw=192.168.31.1"
        ciuser = "<%= ENV['linux_user'] %>"
        cipassword = "<%= ENV['linux_password'] %>"
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
