SHELL=/bin/bash

ifndef vsphere_user
    $(echo vsphere_user is not set. Please set it by sourcing from protected/main.sh and supplying the TS_ENV and TS_STACK)
endif
ifndef vsphere_password
    $(echo vsphere_user is not set)
endif
ifndef vsphere_server
    $(echo vsphere_user is not set)
endif
ifndef esxiHostname
    $(echo vsphere_user is not set)
endif





up:
	terraspace up ${TS_STACK}
plan:
	terraspace plan ${TS_STACK}
apply:
	terraspace up -y ${TS_STACK}
