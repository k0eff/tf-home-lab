proxmox_virtual_machines = {
    vpn = {
        name = "vm500"
        vmid = 500
        target_node = "proxmox"
        clone = "vm200"
        memory = 1024
        balloon = 512
        sockets = 1
        cores = 1
        vcpus = 1
        onboot = true
        ipconfig0 = "ip=192.168.31.150/24,gw=192.168.31.1"
        ciuser = "<%= ENV['linux_user'] %>"
        cipassword = "<%= ENV['linux_password'] %>"
    }


    k8s10 = {
        name = "vm10000"
        vmid = 10000
        target_node = "proxmox"
        clone = "vm200"
        memory = 8192
        balloon = 512
        sockets = 1
        cores = 2
        vcpus = 2
        onboot = true
        ipconfig0 = "ip=192.168.31.190/24,gw=192.168.31.1"
        ciuser = "<%= ENV['linux_user'] %>"
        cipassword = "<%= ENV['linux_password'] %>"
    }
    k8s11 = {
        name = "vm11000"
        vmid = 11000
        target_node = "proxmox"
        clone = "vm200"
        memory = 8192
        balloon = 512
        sockets = 1
        cores = 2
        vcpus = 2
        onboot = true
        ipconfig0 = "ip=192.168.31.191/24,gw=192.168.31.1"
        ciuser = "<%= ENV['linux_user'] %>"
        cipassword = "<%= ENV['linux_password'] %>"
    }
    k8s12 = {
        name = "vm12000"
        vmid = 12000
        target_node = "proxmox"
        clone = "vm200"
        memory = 8192
        balloon = 512
        sockets = 1
        cores = 2
        vcpus = 2
        onboot = true
        ipconfig0 = "ip=192.168.31.192/24,gw=192.168.31.1"
        ciuser = "<%= ENV['linux_user'] %>"
        cipassword = "<%= ENV['linux_password'] %>"
    }
    exo = {
        name = "vm1000"
        vmid = 1000
        target_node = "proxmox"
        clone = "vm200"
        memory = 24576
        balloon = 512
        sockets = 1
        cores = 6
        vcpus = 6
        onboot = true
        ipconfig0 = "ip=192.168.31.180/24,gw=192.168.31.1"
        ciuser = "<%= ENV['linux_user'] %>"
        cipassword = "<%= ENV['linux_password'] %>"
    }
}
