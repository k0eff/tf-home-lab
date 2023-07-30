virtual_machines = {
  vm5000 = {
    dcName        = "MiWiFi-R3600-srv"
    name          = "vm5000"
    resource_pool = "<%= @esxiHostname %>/Resources"
    datastore     = "datastore1"
    num_cpus      = 1
    memory        = 4096
    guest_id      = "ubuntu64Guest"
    network_id    = "VM Network"
    disk = [
      {
        size          = 40
        thin_provisioned = true
        datastore_id  = "64b94188-94a036a8-6947-8c1645927892"
      },
    ]
    # cdrom = {
    #   datastore = "64b94188-94a036a8-6947-8c1645927892"
    #   path      = "images/ubuntu-22.04.2-live-server-amd64.iso"
    # }
    clone = {
      vmName    = "vm20"
      hostname  = "vm5000"
      domain    = "koeff.com"
      ipv4      = "192.168.31.202"
      gw        = "192.168.31.1"
    }
  }
}
