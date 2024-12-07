vsphere_user      = "<%= ENV['vsphere_user'] %>"
vsphere_password  = "<%= ENV["vsphere_password"].gsub("$", "\$") %>"
vsphere_server    = "<%= ENV['vsphere_server'] %>"


proxmox_user           = "<%= ENV['proxmox_user'] %>"
proxmox_pass           = "<%= ENV['proxmox_pass'] %>"
proxmox_api_url        = "<%= ENV['proxmox_api_url'] %>"
