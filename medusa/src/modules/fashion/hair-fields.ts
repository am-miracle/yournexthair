export const PRODUCT_FORMS = ["bundle", "wig", "closure", "frontal", "sample_box"] as const
export type ProductForm = (typeof PRODUCT_FORMS)[number]

export const PRODUCT_TYPE_TO_FORM: Record<string, ProductForm> = {
  "Extensions": "bundle",
  "Wigs & Units": "wig",
  "Closures": "closure",
  "Frontals": "frontal",
  "Sample Box": "sample_box",
}

type FieldRule = "required" | "optional" | "hidden"
type FieldType = "string" | "number" | "boolean" | "enum"

export interface HairFieldDef {
  type: FieldType
  enumValues?: readonly string[]
  label: string
}

export const HAIR_FIELD_DEFS: Record<string, HairFieldDef> = {
  length_in_inches:  { type: "number",  label: "Length (inches)" },
  hair_origin:       { type: "enum",    label: "Hair Origin",      enumValues: ["Brazilian", "Peruvian", "Indian", "Cambodian", "Malaysian"] },
  hair_family:       { type: "enum",    label: "Hair Family",      enumValues: ["Virgin", "Remy", "Processed"] },
  texture:           { type: "enum",    label: "Texture",          enumValues: ["Straight", "Body Wave", "Deep Wave", "Loose Wave", "Kinky Curly", "Water Wave"] },
  fulfillment_mode:  { type: "enum",    label: "Fulfilment",       enumValues: ["ready_to_ship", "custom"] },
  color:             { type: "string",  label: "Colour" },
  lace_size:         { type: "string",  label: "Lace Size" },
  lace_type:         { type: "enum",    label: "Lace Type",        enumValues: ["HD", "Transparent", "Regular"] },
  density:           { type: "number",  label: "Density (%)" },
  cap_construction:  { type: "enum",    label: "Cap Construction", enumValues: ["Lace Front", "Full Lace", "360 Lace", "U-Part", "V-Part"] },
  pre_bleached:      { type: "boolean", label: "Pre-bleached" },
  pre_plucked:       { type: "boolean", label: "Pre-plucked" },
  bundle_deal:       { type: "boolean", label: "Bundle Deal" },
  limited_edition:   { type: "boolean", label: "Limited Edition" },
  sample_box_flag:   { type: "boolean", label: "Sample Box" },
}

export const FORM_FIELD_RULES: Record<ProductForm, Record<string, FieldRule>> = {
  bundle: {
    length_in_inches: "required", hair_origin: "required", hair_family: "required",
    texture: "required", fulfillment_mode: "required", color: "optional",
    lace_size: "hidden", lace_type: "hidden", density: "hidden", cap_construction: "hidden",
    pre_bleached: "hidden", pre_plucked: "hidden",
    bundle_deal: "optional", limited_edition: "optional", sample_box_flag: "hidden",
  },
  wig: {
    length_in_inches: "required", hair_origin: "required", hair_family: "required",
    texture: "required", fulfillment_mode: "required", color: "optional",
    lace_size: "required", lace_type: "required", density: "optional", cap_construction: "required",
    pre_bleached: "optional", pre_plucked: "optional",
    bundle_deal: "hidden", limited_edition: "optional", sample_box_flag: "hidden",
  },
  closure: {
    length_in_inches: "required", hair_origin: "required", hair_family: "required",
    texture: "required", fulfillment_mode: "required", color: "optional",
    lace_size: "required", lace_type: "required", density: "hidden", cap_construction: "hidden",
    pre_bleached: "optional", pre_plucked: "optional",
    bundle_deal: "hidden", limited_edition: "optional", sample_box_flag: "hidden",
  },
  frontal: {
    length_in_inches: "required", hair_origin: "required", hair_family: "required",
    texture: "required", fulfillment_mode: "required", color: "optional",
    lace_size: "required", lace_type: "required", density: "hidden", cap_construction: "hidden",
    pre_bleached: "optional", pre_plucked: "optional",
    bundle_deal: "hidden", limited_edition: "optional", sample_box_flag: "hidden",
  },
  sample_box: {
    length_in_inches: "optional", hair_origin: "optional", hair_family: "optional",
    texture: "optional", fulfillment_mode: "optional", color: "optional",
    lace_size: "hidden", lace_type: "hidden", density: "hidden", cap_construction: "hidden",
    pre_bleached: "hidden", pre_plucked: "hidden",
    bundle_deal: "hidden", limited_edition: "optional", sample_box_flag: "required",
  },
}

export interface ValidationError {
  field: string
  label: string
  rule: "required"
}

export function getMissingPublishFields(
  metadata: Record<string, unknown>,
  productForm: ProductForm
): ValidationError[] {
  const rules = FORM_FIELD_RULES[productForm]
  return Object.entries(rules)
    .filter(([field, rule]) => {
      if (rule !== "required") return false
      const val = metadata[field]
      return val === null || val === undefined || val === ""
    })
    .map(([field]) => ({
      field,
      label: HAIR_FIELD_DEFS[field]?.label ?? field,
      rule: "required" as const,
    }))
}
