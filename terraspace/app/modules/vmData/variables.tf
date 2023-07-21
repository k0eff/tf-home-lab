variable "name" {
  type        = string
  default     = null
}
variable "datacenterId" {
  type        = string
  default     = null
}

variable "tags" {
  description = "(Optional) A mapping of tags to assign to the bucket."
  type        = list(string)
  default     = []
}
