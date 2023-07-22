virtual_machines = [{
    dcName        = "MiWiFi-R3600-srv"
    name          = "vm20"
    resource_pool = "<%= @esxiHostname %>/Resources"
    datastore     = "datastore1"
    num_cpus      = 1
    memory        = 8192
    guest_id      = "debian11_64Guest"
    network_id    = "network-id-2"
    disk = [
      {
        size          = 80
        thin_provisioned = true
        datastore_id  = "datastore-id-3"
      },
    ]
  }
]
