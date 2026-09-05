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
        # 16 -> 32 GB on the owner's instruction, 2026-09-06: raise it to 32,
        # the host has 64 and 24 are in use. (His words verbatim are in
        # imotbgScraper2026/tasks/T-942.json, which is where the ledger
        # convention keeps them; code comments here stay in English.)
        #
        # WHY: vm700 carries the whole imot2026 estate — ~24 containers, a
        # single-node Kafka and the production Mongo. Measured 2026-09-05:
        # 15,993 MB total with only 527 MB free, 2,559 MB already in swap, and
        # mongod itself holding ~400 MB of that swap. imot2026-mongo was
        # CFS-throttled in 45% of scheduler periods and read 34 TB back into a
        # 512 MB WiredTiger cache over 127 hours. T-942 raises that cache to
        # 4.5 GB and the container limit to 6 GB, which does not fit
        # comfortably in 16 GB beside everything else — this is the headroom
        # that makes that change safe rather than merely possible.
        #
        # THE ARITHMETIC. Ceilings sum to more than the host has; floors do
        # not, and the floors are what actually bind.
        #
        #   ceilings  49 -> 65 GB   against 64 GB physical
        #   floors    32.8 -> 35.3 GB (this VM's 32768, pinned, plus 512 each
        #                              for the other five)
        #
        # Every other VM here sets `balloon = 512`, so the hypervisor can
        # reclaim from them under pressure. THIS one sets balloon == memory,
        # which pins it: a database must not have memory taken back underneath
        # it while WiredTiger believes it holds a 4.5 GB cache. That asymmetry
        # is the whole design — the ops box is guaranteed, the rest flex.
        #
        # So the over-commit at the ceiling is real but not the number to watch.
        # If the host does come under pressure, the lever is the other five VMs'
        # balloon floors, not this VM's ceiling.
        memory = 32768
        balloon = 32768
        sockets = 1
        # 4 -> 5 vCPUs on the owner's instruction, 2026-09-06, in the same
        # reboot as the memory change rather than a second one.
        #
        # This is what makes docker-compose.yml.j2's `cpus: "4.0"` for
        # imot2026-mongo a limit again instead of the whole machine. At 4 cores
        # a mongod allowed 4.0 could take every core and starve Kafka and the
        # twenty app containers; at 5 it leaves one, which is the difference
        # between a cap and a fiction. The two numbers are coupled — if this
        # drops back to 4, mongo's limit has to drop with it.
        #
        # vCPU over-commit across the estate goes 12 -> 13 and is not the same
        # class of risk as the memory over-commit above: the hypervisor time-
        # slices CPU, it cannot time-slice RAM.
        cores = 5
        vcpus = 5
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
