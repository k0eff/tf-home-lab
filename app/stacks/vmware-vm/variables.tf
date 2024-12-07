variable "vmware_virtual_machines" {
  type = map(object({
    dcName         = string
    name           = string
    resource_pool  = string
    datastore      = optional(string)
    num_cpus       = optional(number)
    memory_limit   = optional(number)
    memory         = optional(number)
    guest_id       = optional(string) # check here: https://vdc-download.vmware.com/vmwb-repository/dcr-public/b50dcbbf-051d-4204-a3e7-e1b618c1e384/538cf2ec-b34f-4bae-a332-3820ef9e7773/vim.vm.GuestOsDescriptor.GuestOsIdentifier.html
    enableDiskUUID = optional(bool)
    disk = list(object({
      size             = number
      eagerly_scrub    = optional(bool)
      thin_provisioned = optional(bool)
      datastore_id     = optional(string)
    }))
    network_id = string
    cdrom = optional(object({
      datastore = optional(string)
      path      = optional(string)
    }))
    clone = optional(object({
      vmName   = optional(string)
      hostname = optional(string)
      domain   = optional(string)
      ipv4     = optional(string)
      gw       = optional(string)
    }))
  }))
}

variable "vmware_storagePolicies" {
  default = {}
  type = map(object({
    name        = string
    description = string
    tagRules = map(object({
      tagCategoryName = string
      tags            = list(string)
      inclDsTags      = optional(bool, true)
    }))
  }))
}
