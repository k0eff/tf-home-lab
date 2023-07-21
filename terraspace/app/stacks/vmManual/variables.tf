variable "tags" {
  description = "(Optional) A mapping of tags to assign to the bucket."
  type        = map(string)
  default     = {}
}
variable "name" {
  type        = string
  default     = null
}

variable "options" {
  type = list(object({
    vmName = string
    dcName = string
    tags   = optional(list(string))
  }))
}