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


    k8s1 = {
        name = "node1"
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
    k8s2 = {
        name = "node2"
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
    k8s3 = {
        name = "node3"
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

}
