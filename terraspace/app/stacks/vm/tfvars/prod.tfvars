virtual_machines = [{
    dcName        = "MiWiFi-R3600-srv"
    name          = "vm20"
    resource_pool = "<%= @esxiHostname %>/Resources"
    datastore     = "datastore1"
    num_cpus      = 1
    memory        = 8192
    guest_id      = "debian11_64Guest"
    network_id    = "VM Network"
    disk = [
      {
        size          = 80
        thin_provisioned = true
        datastore_id  = "64b94188-94a036a8-6947-8c1645927892"
      },
    ]
  }
]
