virtual_machines = {
  vm5000 = {
    dcName        = "datacenter02"
    name          = "vm5000"
    resource_pool = "rp01"
    datastore     = "datastore1"
    num_cpus      = 1
    memory        = 4096
    guest_id      = "ubuntu64Guest"
    network_id    = "VM Network"
    disk = [
      {
        size          = 40
        thin_provisioned = true
      },
    ]
    clone = {
      vmName    = "vm20"
      hostname  = "vm5000"
      domain    = "koeff.com"
      ipv4      = "192.168.31.202"
      gw        = "192.168.31.1"
    }
  }
}
