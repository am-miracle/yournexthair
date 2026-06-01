type SingleProp<K extends string, V> = {
  [P in K]: V
}

export const withProp = <K extends string, V>(
  key: K,
  value: V,
): SingleProp<K, V> => ({ [key]: value }) as SingleProp<K, V>

export const withDefinedProp = <K extends string, V>(
  key: K,
  value: V | undefined,
): SingleProp<K, V> | {} => (value === undefined ? {} : withProp(key, value))

export const withNonNullProp = <K extends string, V>(
  key: K,
  value: V | null | undefined,
): SingleProp<K, NonNullable<V>> | {} =>
  value === null || value === undefined ? {} : withProp(key, value as NonNullable<V>)

export const withConditionalProp = <K extends string, V>(
  condition: boolean,
  key: K,
  value: V,
): SingleProp<K, V> | {} => (condition ? withProp(key, value) : {})
