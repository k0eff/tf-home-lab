variable "policies" {
  default = []
  type = map(object({
    name        = string
    description = string
    tagRules = map(object({
        tagCategoryName = string
        tags = list(string)
        inclDsTags = optional(bool, true)
    }))
  }))
}
