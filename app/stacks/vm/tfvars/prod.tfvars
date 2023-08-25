virtual_machines = {
  vm50 = {
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
      ipv4     = "192.168.31.202"
      gw       = "192.168.31.1"
    }
  }
  vm5000 = {
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

  vm6000 = {
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

  vm7000 = {
    dcName         = "datacenter02"
    name           = "vm7000"
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
      hostname = "vm7000"
      domain   = "koeff.com"
      ipv4     = "192.168.31.204"
      gw       = "192.168.31.1"
    }
  }
}

storagePolicies = {
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
