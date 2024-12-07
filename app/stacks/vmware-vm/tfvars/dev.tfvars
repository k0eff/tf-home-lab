virtual_machines = {
  vm1000 = { # cluster01-dev
    dcName         = "datacenter02"
    name           = "vm1000"
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
      hostname = "vm1000"
      domain   = "koeff.com"
      ipv4     = "192.168.31.190"
      gw       = "192.168.31.1"
    }
  }

  vm1100 = { # cluster01-dev
    dcName         = "datacenter02"
    name           = "vm1100"
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
      hostname = "vm1100"
      domain   = "koeff.com"
      ipv4     = "192.168.31.191"
      gw       = "192.168.31.1"
    }
  }

  vm1200 = { # cluster01-dev
    dcName         = "datacenter02"
    name           = "vm1200"
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
      hostname = "vm1200"
      domain   = "koeff.com"
      ipv4     = "192.168.31.192"
      gw       = "192.168.31.1"
    }
  }
}


storagePolicies = {
  cluster01-dev = {
    name        = "cluster01-devPolicy"
    description = "Policy for cluster01-dev"
    tagRules = {
      clusterTags = {
        tagCategoryName = "k8s-cluster"
        tags            = ["cluster01-dev"]
        inclDsTags      = true
      }
    }
  }
}
