import { HttpTypes } from "@medusajs/types"
import { LocalizedLink } from "@/components/LocalizedLink"
import { parseHairMeta, type HairMeta } from "@lib/util/parse-hair-meta"

type ProductInfoProps = {
  product: HttpTypes.StoreProduct
}

const FULFILLMENT_LABELS: Record<string, string> = {
  ready_to_ship: "Ready to ship",
  custom: "Made to order",
}

const HairSpecs: React.FC<{ meta: HairMeta }> = ({ meta }) => {
  const boolFlags = (["pre_bleached", "pre_plucked"] as const).filter((k) => meta[k] === true)

  return (
    <div className="mt-6 pt-6 border-t border-grayscale-100">
      <p className="text-xs uppercase tracking-widest text-grayscale-400 mb-3">Hair Details</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-1.5">
        {meta.hair_origin && (
          <>
            <dt className="text-sm text-grayscale-400">Origin</dt>
            <dd className="text-sm">{meta.hair_origin}</dd>
          </>
        )}
        {meta.hair_family && (
          <>
            <dt className="text-sm text-grayscale-400">Family</dt>
            <dd className="text-sm">{meta.hair_family}</dd>
          </>
        )}
        {meta.texture && (
          <>
            <dt className="text-sm text-grayscale-400">Texture</dt>
            <dd className="text-sm">{meta.texture}</dd>
          </>
        )}
        {meta.length_in_inches !== null && (
          <>
            <dt className="text-sm text-grayscale-400">Length</dt>
            <dd className="text-sm">{meta.length_in_inches}&quot;</dd>
          </>
        )}
        {meta.lace_size && (
          <>
            <dt className="text-sm text-grayscale-400">Lace</dt>
            <dd className="text-sm">
              {meta.lace_size}
              {meta.lace_type && ` · ${meta.lace_type}`}
            </dd>
          </>
        )}
        {meta.cap_construction && (
          <>
            <dt className="text-sm text-grayscale-400">Construction</dt>
            <dd className="text-sm">{meta.cap_construction}</dd>
          </>
        )}
        {meta.density !== null && (
          <>
            <dt className="text-sm text-grayscale-400">Density</dt>
            <dd className="text-sm">{meta.density}%</dd>
          </>
        )}
        {meta.fulfillment_mode && (
          <>
            <dt className="text-sm text-grayscale-400">Fulfilment</dt>
            <dd className="text-sm">
              {FULFILLMENT_LABELS[meta.fulfillment_mode] ?? meta.fulfillment_mode}
            </dd>
          </>
        )}
      </dl>
      {boolFlags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {boolFlags.map((flag) => (
            <span
              key={flag}
              className="text-xs px-2.5 py-1 border border-grayscale-200 rounded-full text-grayscale-500"
            >
              {flag === "pre_bleached" ? "Pre-bleached" : "Pre-plucked"}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

const ProductInfo = ({ product }: ProductInfoProps) => {
  const hairMeta = parseHairMeta(product.metadata as Record<string, unknown> | null)

  return (
    <>
      {product.collection && (
        <LocalizedLink
          href={`/collections/${product.collection.handle}`}
          className="text-medium text-fg-muted dark:text-fg-muted-dark hover:text-fg-subtle dark:hover:text-fg-subtle-dark"
        >
          <p className="text-grayscale-500 mb-2">{product.collection.title}</p>
        </LocalizedLink>
      )}
      <h1 className="text-md md:text-xl mb-2">{product.title}</h1>
      {hairMeta && <HairSpecs meta={hairMeta} />}
    </>
  )
}

export default ProductInfo
