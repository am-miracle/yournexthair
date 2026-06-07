export interface HairMeta {
  hair_origin?: string
  hair_family?: string
  texture?: string
  length_in_inches?: number
  color?: string
  lace_size?: string
  lace_type?: string
  density?: number
  cap_construction?: string
  fulfillment_mode?: string
  pre_bleached?: boolean
  pre_plucked?: boolean
  bundle_deal?: boolean
  limited_edition?: boolean
}

const str = (raw: Record<string, unknown>, key: string): string | undefined => {
  const v = raw[key]
  return typeof v === "string" && v.trim() !== "" ? v : undefined
}

const num = (raw: Record<string, unknown>, key: string): number | undefined => {
  const v = raw[key]
  if (typeof v === "number" && !isNaN(v)) return v
  if (typeof v === "string") {
    const n = Number(v)
    return !isNaN(n) && v.trim() !== "" ? n : undefined
  }
  return undefined
}

const bool = (raw: Record<string, unknown>, key: string): boolean | undefined => {
  const v = raw[key]
  return typeof v === "boolean" ? v : undefined
}

export function parseHairMeta(raw: Record<string, unknown> | null | undefined): HairMeta | null {
  if (!raw || typeof raw !== "object") return null

  const result: HairMeta = {}

  const s = str(raw, "hair_origin");        if (s  !== undefined) result.hair_origin     = s
  const f = str(raw, "hair_family");        if (f  !== undefined) result.hair_family     = f
  const t = str(raw, "texture");            if (t  !== undefined) result.texture          = t
  const l = num(raw, "length_in_inches");   if (l  !== undefined) result.length_in_inches = l
  const c = str(raw, "color");              if (c  !== undefined) result.color            = c
  const ls = str(raw, "lace_size");         if (ls !== undefined) result.lace_size        = ls
  const lt = str(raw, "lace_type");         if (lt !== undefined) result.lace_type        = lt
  const d = num(raw, "density");            if (d  !== undefined) result.density          = d
  const cc = str(raw, "cap_construction");  if (cc !== undefined) result.cap_construction = cc
  const fm = str(raw, "fulfillment_mode");  if (fm !== undefined) result.fulfillment_mode = fm
  const pb = bool(raw, "pre_bleached");     if (pb !== undefined) result.pre_bleached     = pb
  const pp = bool(raw, "pre_plucked");      if (pp !== undefined) result.pre_plucked      = pp
  const bd = bool(raw, "bundle_deal");      if (bd !== undefined) result.bundle_deal      = bd
  const le = bool(raw, "limited_edition");  if (le !== undefined) result.limited_edition  = le

  return Object.keys(result).length > 0 ? result : null
}
