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
        onboot = false
        ipconfig0 = "ip=192.168.31.150/24,gw=192.168.31.1"
        ciuser = "<%= ENV['linux_user'] %>"
        cipassword = "<%= ENV['linux_password'] %>"
    }
    desktoplinux = {
        name = "vm600"
        vmid = 600
        target_node = "proxmox"
        clone = "vm200"
        memory = 8192
        balloon = 512
        sockets = 1
        cores = 1
        vcpus = 1
        onboot = true
        ipconfig0 = "ip=192.168.31.151/24,gw=192.168.31.1"
        ciuser = "<%= ENV['linux_user'] %>"
        cipassword = "<%= ENV['linux_password'] %>"
    }
    
    # RocketChat (Upgraded to 8.4.3. Manual DB backup at /var/lib/docker-data/rocketchat-mongo/rocketchat-backup-8.0.1.archive)
    #
    # Despite the block name this host is the general-purpose "ops" box: it also
    # runs LiteLLM (koeff-ai-stack), music-production-engine and OmniRoute.
    # CPU/RAM were raised in the Proxmox UI and never written back here; an
    # apply against the old 8192/1-core figures would have halved the VM under
    # the running workload. Values below match what the hypervisor reports.
    rocketchat = {
        name = "vm700"
        vmid = 700
        target_node = "proxmox"
        clone = "vm200"
        memory = 16384
        balloon = 16384
        sockets = 1
        cores = 4
        vcpus = 4
        onboot = true
        ipconfig0 = "ip=192.168.31.152/24,gw=192.168.31.1"
        ciuser = "<%= ENV['linux_user'] %>"
        cipassword = "<%= ENV['linux_password'] %>"
        disks = {
            extra = {
             storage = "local-lvm"
             slot = "scsi1"
             size = "200G"
            }
        }
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
