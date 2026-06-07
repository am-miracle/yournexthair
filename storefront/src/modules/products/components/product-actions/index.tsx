"use client"

import { useMemo, useState } from "react"
import { HttpTypes } from "@medusajs/types"
import * as ReactAria from "react-aria-components"
import { useSearchParams } from "next/navigation"
import { getVariantItemsInStock } from "@lib/util/inventory"
import { Button } from "@/components/Button"
import { InputNumberField } from "@/components/InputNumberField"
import { useCountryCode } from "@/hooks/country-code"
import ProductPrice from "@modules/products/components/product-price"
import { UiRadioGroup } from "@/components/ui/Radio"
import { useAddLineItem } from "@/hooks/cart"
import { buildAvailabilityMap } from "./availability"

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  materials: {
    id: string
    name: string
    colors: {
      id: string
      name: string
      hex_code: string
    }[]
  }[]
  region: HttpTypes.StoreRegion
  disabled?: boolean
}

const optionsAsKeymap = (variantOptions: HttpTypes.StoreProductVariant["options"]) =>
  variantOptions?.reduce((acc: Record<string, string>, varopt) => {
    if (varopt.option_id) acc[varopt.option_id] = varopt.value
    return acc
  }, {})

const priorityOptions = ["Material", "Color", "Length", "Density", "Lace Size", "Origin"]

const normalizeOptionKey = (key: string) => key.trim().toLowerCase().replace(/\s+/g, "_")

const areOptionMapsEqual = (
  left: Record<string, string | undefined> | undefined,
  right: Record<string, string | undefined> | undefined,
) => {
  if (!left || !right) return left === right
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  return leftKeys.every((key) => left[key] === right[key])
}

const getInitialOptions = (product: ProductActionsProps["product"]) => {
  if (product.variants?.length === 1) {
    const firstVariant = product.variants[0]
    if (!firstVariant) return {}
    return optionsAsKeymap(firstVariant.options) ?? {}
  }

  if (product.options) {
    return product.options
      .filter((o) => o.values?.length === 1)
      .reduce(
        (acc, o) => {
          const only = o.values?.[0]?.value
          if (only) acc[o.id] = only
          return acc
        },
        {} as Record<string, string>,
      )
  }

  return null
}

// Sort values numerically when they look like numbers (handles "10"", "12"", etc.)
const sortValues = (values: Array<{ id: string; value: string }>) =>
  [...values].sort((a, b) => {
    const aNum = parseFloat(a.value)
    const bNum = parseFloat(b.value)
    return !isNaN(aNum) && !isNaN(bNum) ? aNum - bNum : a.value.localeCompare(b.value)
  })

// Shared pill button style
const pillClass =
  "px-3 py-1.5 text-xs tracking-wide cursor-pointer rounded border transition-all " +
  "border-grayscale-200 hover:border-grayscale-700 " +
  "data-selected:border-black data-selected:bg-black data-selected:text-white " +
  "data-disabled:opacity-35 data-disabled:cursor-not-allowed data-disabled:line-through " +
  "data-disabled:border-grayscale-100"

function ProductActions({ product, materials, disabled }: ProductActionsProps) {
  const searchParams = useSearchParams()
  const [options, setOptions] = useState<Record<string, string | undefined>>(
    getInitialOptions(product) ?? {},
  )
  const [quantity, setQuantity] = useState(1)
  const countryCode = useCountryCode()
  const { mutateAsync, isPending } = useAddLineItem()

  // Re-initialise when product changes (component reuse across products)
  const [prevProduct, setPrevProduct] = useState(product)
  if (prevProduct !== product) {
    setPrevProduct(product)
    const initial = getInitialOptions(product)
    if (initial) setOptions(initial)
  }

  // Apply MCP URL option params
  const [prevSearchParams, setPrevSearchParams] = useState(searchParams)
  const [prevProductOptions, setPrevProductOptions] = useState(product.options)
  if (prevSearchParams !== searchParams || prevProductOptions !== product.options) {
    setPrevSearchParams(searchParams)
    setPrevProductOptions(product.options)

    const optionEntries = Array.from(searchParams.entries()).filter(([key]) =>
      key.startsWith("mcp_opt_"),
    )

    if (optionEntries.length && product.options?.length) {
      const requestedValues = optionEntries.reduce(
        (acc, [key, value]) => {
          acc[normalizeOptionKey(key.replace(/^mcp_opt_/, ""))] = value
          return acc
        },
        {} as Record<string, string>,
      )

      const mappedOptions = (product.options ?? []).reduce(
        (acc, option) => {
          const selectedValue =
            requestedValues[normalizeOptionKey(option.id)] ??
            requestedValues[normalizeOptionKey(option.title ?? "")]
          if (!selectedValue) return acc
          const allowed = new Set((option.values ?? []).map((v) => v.value))
          if (allowed.size && !allowed.has(selectedValue)) return acc
          acc[option.id] = selectedValue
          return acc
        },
        {} as Record<string, string>,
      )

      if (Object.keys(mappedOptions).length) {
        setOptions((prev) => ({ ...prev, ...mappedOptions }))
      }
    }
  }

  const selectedVariant = useMemo(() => {
    if (!product.variants?.length) return undefined
    return product.variants.find((v) => areOptionMapsEqual(optionsAsKeymap(v.options), options))
  }, [product.variants, options])

  const setOptionValue = (optionId: string, value: string) =>
    setOptions((prev) => ({ ...prev, [optionId]: value }))

  // Pre-compute availability for all options in one pass. Render-time lookup is O(1).
  const availabilityMap = useMemo(
    () => buildAvailabilityMap(product.variants ?? [], options),
    [product.variants, options],
  )
  const getAvailableValues = (optionId: string) => availabilityMap.get(optionId) ?? new Set<string>()

  const itemsInStock = selectedVariant ? getVariantItemsInStock(selectedVariant) : 0

  const handleAddToCart = async (): Promise<void> => {
    if (!selectedVariant?.id) return
    await mutateAsync({ variantId: selectedVariant.id, quantity, countryCode })
  }

  const hasMultipleVariants = (product.variants?.length ?? 0) > 1

  const productOptions = (product.options ?? []).slice().sort((a, b) => {
    const ai = priorityOptions.indexOf(a.title ?? "")
    const bi = priorityOptions.indexOf(b.title ?? "")
    return (ai === -1 ? priorityOptions.length : ai) - (bi === -1 ? priorityOptions.length : bi)
  })

  const materialOption = productOptions.find((o) => o.title === "Material")
  const colorOption = productOptions.find((o) => o.title === "Color")
  const otherOptions =
    materialOption && colorOption
      ? productOptions.filter((o) => o.id !== materialOption.id && o.id !== colorOption.id)
      : productOptions

  const selectedMaterial =
    materialOption && options[materialOption.id]
      ? materials.find((m) => m.name === options[materialOption.id])
      : undefined

  const showOtherOptions =
    !materialOption ||
    !colorOption ||
    (selectedMaterial && (selectedMaterial.colors.length < 2 || options[colorOption.id]))

  // Smart CTA label: tell the customer exactly what to select next
  const firstUnsetOption = productOptions.find((o) => !options[o.id])
  const ctaLabel = !selectedVariant
    ? `Select ${firstUnsetOption?.title?.toLowerCase() ?? "variant"}`
    : !itemsInStock
      ? "Out of stock"
      : "Add to cart"

  return (
    <>
      <div key={selectedVariant?.id ?? "base"} className="animate-in fade-in duration-150">
        <ProductPrice
          product={product}
          {...(selectedVariant ? { variant: selectedVariant } : {})}
        />
      </div>

      <div className="max-md:text-xs mb-8 md:mb-16 max-w-120">
        <p>{product.description}</p>
      </div>

      {hasMultipleVariants && (
        <div className="flex flex-col gap-5 mb-4 md:mb-26">
          {materialOption && colorOption && (
            <>
              <div>
                <p className="mb-2">
                  Materials
                  {options[materialOption.id] && (
                    <span className="text-grayscale-500 ml-6">{options[materialOption.id]}</span>
                  )}
                </p>
                <UiRadioGroup
                  value={options[materialOption.id] ?? null}
                  onChange={(value) => setOptions({ [materialOption.id]: `${value}` })}
                  aria-label="Material"
                  className="flex flex-wrap gap-2"
                  isDisabled={!!disabled || isPending}
                >
                  {materials.map((material) => {
                    const available = getAvailableValues(materialOption.id)
                    const isUnavailable = available.size > 0 && !available.has(material.name)
                    return (
                      <ReactAria.RadioField
                        key={material.id}
                        value={material.name}
                        isDisabled={isUnavailable}
                        className="contents"
                      >
                        <ReactAria.RadioButton className={pillClass}>
                          {material.name}
                        </ReactAria.RadioButton>
                      </ReactAria.RadioField>
                    )
                  })}
                </UiRadioGroup>
              </div>

              {selectedMaterial && (
                <div className="mb-2">
                  <p className="mb-2">
                    Colors
                    <span className="text-grayscale-500 ml-6">{options[colorOption.id]}</span>
                  </p>
                  <UiRadioGroup
                    value={options[colorOption.id] ?? null}
                    onChange={(value) => setOptionValue(colorOption.id, value)}
                    aria-label="Colour"
                    className="flex flex-wrap gap-5"
                    isDisabled={!!disabled || isPending}
                  >
                    {selectedMaterial.colors.map((color) => {
                      const available = getAvailableValues(colorOption.id)
                      const isUnavailable = available.size > 0 && !available.has(color.name)
                      return (
                        <ReactAria.RadioField
                          key={color.id}
                          value={color.name}
                          aria-label={color.name}
                          isDisabled={isUnavailable}
                          className="flex flex-col items-center gap-1.5 cursor-pointer data-disabled:cursor-not-allowed data-disabled:opacity-40"
                        >
                          <ReactAria.RadioButton
                            className="h-9 w-9 rounded-full transition-all ring-black ring-offset-2 data-selected:ring-2 hover:scale-105 data-disabled:hover:scale-100 data-disabled:cursor-not-allowed"
                            style={{ background: color.hex_code }}
                          />
                          <span className="text-xs text-grayscale-400 data-parent-selected:text-black transition-colors leading-none">
                            {color.name}
                          </span>
                        </ReactAria.RadioField>
                      )
                    })}
                  </UiRadioGroup>
                </div>
              )}
            </>
          )}
          {showOtherOptions &&
            otherOptions.map((option) => {
              const available = getAvailableValues(option.id)
              const sorted = sortValues((option.values ?? []).filter((v) => Boolean(v.value)))
              return (
                <div key={option.id}>
                  <p className="mb-2">
                    {option.title}
                    {options[option.id] && (
                      <span className="text-grayscale-500 ml-6">{options[option.id]}</span>
                    )}
                  </p>
                  <UiRadioGroup
                    value={options[option.id] ?? null}
                    onChange={(value) => setOptionValue(option.id, value)}
                    aria-label={option.title ?? ""}
                    className="flex flex-wrap gap-2"
                    isDisabled={!!disabled || isPending}
                  >
                    {sorted.map((v) => {
                      const isUnavailable = available.size > 0 && !available.has(v.value)
                      return (
                        <ReactAria.RadioField
                          key={v.id}
                          value={v.value}
                          aria-label={v.value}
                          isDisabled={isUnavailable}
                          className="contents"
                        >
                          <ReactAria.RadioButton className={pillClass}>
                            {v.value}
                          </ReactAria.RadioButton>
                        </ReactAria.RadioField>
                      )
                    })}
                  </UiRadioGroup>
                </div>
              )
            })}
        </div>
      )}

      <div className="flex max-sm:flex-col gap-4">
        <InputNumberField
          isDisabled={!itemsInStock || !selectedVariant || !!disabled || isPending}
          value={quantity}
          onChange={setQuantity}
          minValue={1}
          maxValue={itemsInStock}
          className="w-full sm:w-35 max-md:justify-center max-md:gap-2"
          aria-label="Quantity"
        />
        <Button
          onPress={handleAddToCart}
          isDisabled={!itemsInStock || !selectedVariant || !!disabled}
          isLoading={isPending}
          className="sm:flex-1"
        >
          {ctaLabel}
        </Button>
      </div>
    </>
  )
}

export default ProductActions
