vmware_virtual_machines = {
  vm50 = { // vpn server
    dcName         = "datacenter02"
    name           = "vm50"
    resource_pool  = "rp01"
    datastore      = "datastore1"
    num_cpus       = 1
    memory_limit   = 2048
    memory         = 1536
    guest_id       = "ubuntu64Guest"
    network_id     = "VM Network"
    enableDiskUUID = true
    onboot = true
    disk = [
      {
        size             = 40
        thin_provisioned = true
      },
    ]
    clone = {
      vmName   = "vm20"
      hostname = "vm50"
      domain   = "koeff.com"
      ipv4     = "192.168.31.150"
      gw       = "192.168.31.1"
    }
  }
  vm60 = { // diskstorage
    dcName         = "datacenter02"
    name           = "vm60"
    resource_pool  = "rp01"
    datastore      = "datastore1"
    num_cpus       = 1
    memory_limit   = 2048
    memory         = 1024
    guest_id       = "ubuntu64Guest"
    network_id     = "VM Network"
    enableDiskUUID = true
    disk = [
      {
        size             = 40
        thin_provisioned = true
      },
    ]
    clone = {
      vmName   = "vm20"
      hostname = "vm60"
      domain   = "koeff.com"
      ipv4     = "192.168.31.151"
      gw       = "192.168.31.1"
    }
  }
  vm70 = { // docker
    dcName         = "datacenter02"
    name           = "vm70"
    resource_pool  = "rp01"
    datastore      = "datastore1"
    num_cpus       = 2
    memory_limit   = 2048
    memory         = 2048
    guest_id       = "ubuntu64Guest"
    network_id     = "VM Network"
    enableDiskUUID = true
    disk = [
      {
        size             = 40
        thin_provisioned = true
      },
    ]
    clone = {
      vmName   = "vm20"
      hostname = "vm70"
      domain   = "koeff.com"
      ipv4     = "192.168.31.152"
      gw       = "192.168.31.1"
    }
  }
  vm5000 = { // k8s
    dcName         = "datacenter02"
    name           = "vm5000"
    resource_pool  = "rp01"
    datastore      = "datastore1"
    num_cpus       = 1
    memory_limit   = 8192
    memory         = 8192
    guest_id       = "ubuntu64Guest"
    network_id     = "VM Network"
    enableDiskUUID = true
    disk = [
      {
        size             = 40
        thin_provisioned = true
      },
    ]
    clone = {
      vmName   = "vm20"
      hostname = "vm5000"
      domain   = "koeff.com"
      ipv4     = "192.168.31.202"
      gw       = "192.168.31.1"
    }
  }

  vm6000 = { // k8s
    dcName         = "datacenter02"
    name           = "vm6000"
    resource_pool  = "rp01"
    datastore      = "datastore1"
    num_cpus       = 1
    memory_limit   = 4096
    memory         = 4096
    guest_id       = "ubuntu64Guest"
    network_id     = "VM Network"
    enableDiskUUID = true
    disk = [
      {
        size             = 40
        thin_provisioned = true
      },
    ]
    clone = {
      vmName   = "vm20"
      hostname = "vm6000"
      domain   = "koeff.com"
      ipv4     = "192.168.31.203"
      gw       = "192.168.31.1"
    }
  }

  vm7000 = { // k8s
    dcName         = "datacenter02"
    name           = "vm7000"
    resource_pool  = "rp01"
    datastore      = "datastore1"
    num_cpus       = 6
    memory_limit   = 6144
    memory         = 6144
    guest_id       = "ubuntu64Guest"
    network_id     = "VM Network"
    enableDiskUUID = true
    disk = [
      {
        size             = 40
        thin_provisioned = true
      },
    ]
    clone = {
      vmName   = "vm20"
      hostname = "vm7000"
      domain   = "koeff.com"
      ipv4     = "192.168.31.204"
      gw       = "192.168.31.1"
    }
  }
}

vmware_storagePolicies = {
  cluster00 = {
    name        = "cluster00Policy"
    description = "Policy for cluster00"
    tagRules = {
      clusterTags = {
        tagCategoryName = "k8s-cluster"
        tags            = ["cluster00"]
        inclDsTags      = true
      }
    }
  }
}
