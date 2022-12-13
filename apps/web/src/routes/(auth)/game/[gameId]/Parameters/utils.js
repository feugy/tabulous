import Choice from './Choice.svelte'

export function buildComponents(values, schema, nested = false) {
  const components = []
  for (const [name, property] of Object.entries(schema?.properties ?? {})) {
    if (property.enum) {
      components.push({ name, property, values, component: Choice })
    }
  }
  findViolations(values, schema, values, condition => {
    components.push(...buildComponents(values, condition, true))
  })
  if (!nested) {
    // at the very end, trim out undesired properties
    const allowedProperties = components.map(({ name }) => name)
    const properties = Object.keys(values ?? {})
    for (const name of properties) {
      if (!allowedProperties.includes(name)) {
        values[name] = undefined
      }
    }
  }
  return components
}

export function findViolations(value, schema, context = {}, enrichProps) {
  let {
    enum: candidates,
    const: constant,
    // number
    minimum,
    exclusiveMinimum,
    maximum,
    exclusiveMaximum,
    multipleOf,
    // string
    maxLength,
    minLength,
    pattern,
    // array
    minItems,
    maxItems,
    uniqueItems,
    // object
    maxProperties,
    minProperties,
    required,
    properties,
    // compounds
    not,
    oneOf,
    anyOf,
    allOf,
    if: condition,
    then: conditionThen,
    else: conditionElse
  } = schema

  const violations = []

  if (candidates) {
    const candidateValues = resolveData(candidates, context) ?? []
    if (
      !Array.isArray(candidateValues) ||
      candidateValues.every(candidate => !equals(value, candidate))
    ) {
      violations.push({ enum: candidateValues, value })
    }
  }
  if (constant) {
    const expected = resolveData(constant, context)
    if (!equals(value, expected)) {
      violations.push({ const: expected, value })
    }
  }
  if (minimum) {
    const limit = resolveData(minimum, context)
    if (
      typeof value !== 'number' ||
      typeof limit !== 'number' ||
      value < limit
    ) {
      violations.push({ minimum: limit, value })
    }
  }
  if (exclusiveMinimum) {
    const limit = resolveData(exclusiveMinimum, context)
    if (
      typeof value !== 'number' ||
      typeof limit !== 'number' ||
      value <= limit
    ) {
      violations.push({ exclusiveMinimum: limit, value })
    }
  }
  if (maximum) {
    const limit = resolveData(maximum, context)
    if (
      typeof value !== 'number' ||
      typeof limit !== 'number' ||
      value > limit
    ) {
      violations.push({ maximum: limit, value })
    }
  }
  if (exclusiveMaximum) {
    const limit = resolveData(exclusiveMaximum, context)
    if (
      typeof value !== 'number' ||
      typeof limit !== 'number' ||
      value >= limit
    ) {
      violations.push({ exclusiveMaximum: limit, value })
    }
  }
  if (multipleOf) {
    const multiple = resolveData(multipleOf, context)
    if (
      typeof value !== 'number' ||
      typeof multiple !== 'number' ||
      value % multiple !== 0
    ) {
      violations.push({ multipleOf: multiple, value })
    }
  }
  if (maxLength) {
    const limit = resolveData(maxLength, context)
    if (
      typeof value !== 'string' ||
      typeof limit !== 'number' ||
      value.length > limit
    ) {
      violations.push({ maxLength: limit, value })
    }
  }
  if (minLength) {
    const limit = resolveData(minLength, context)
    if (
      typeof value !== 'string' ||
      typeof limit !== 'number' ||
      value.length < limit
    ) {
      violations.push({ minLength: limit, value })
    }
  }
  if (pattern) {
    const patternString = resolveData(pattern, context)
    if (
      typeof value !== 'string' ||
      typeof patternString !== 'string' ||
      !new RegExp(patternString).test(value)
    ) {
      violations.push({ pattern: patternString, value })
    }
  }
  // TODO format https://ajv.js.org/json-schema.html#format, supports $data
  if (maxItems) {
    const limit = resolveData(maxItems, context)
    if (
      !Array.isArray(value) ||
      typeof limit !== 'number' ||
      value.length > limit
    ) {
      maxItems
      violations.push({ pattern: limit, value })
    }
  }
  if (minItems) {
    const limit = resolveData(minItems, context)
    if (
      !Array.isArray(value) ||
      typeof limit !== 'number' ||
      value.length < limit
    ) {
      violations.push({ minItems: limit, value })
    }
  }
  if (uniqueItems) {
    const shouldBeUnique = resolveData(uniqueItems, context)
    if (
      !Array.isArray(value) ||
      typeof shouldBeUnique !== 'boolean' ||
      (shouldBeUnique === true && new Set(value).size !== value.length)
    ) {
      violations.push({ uniqueItems: shouldBeUnique, value })
    }
  }
  // TODO items https://ajv.js.org/json-schema.html#items-in-draft-2020-12
  // TODO prefixItems https://ajv.js.org/json-schema.html#prefixitems
  // TODO additionalItems https://ajv.js.org/json-schema.html#additionalitems
  // TODO contains https://ajv.js.org/json-schema.html#contains
  // TODO maxContains/minContains https://ajv.js.org/json-schema.html#maxcontains-mincontains
  // TODO unevaluatedItems https://ajv.js.org/json-schema.html#unevaluateditems
  if (maxProperties) {
    const limit = resolveData(maxProperties, context)
    if (
      typeof value !== 'object' ||
      typeof limit !== 'number' ||
      Object.keys(value).length > limit
    ) {
      violations.push({ maxProperties: limit, value })
    }
  }
  if (minProperties) {
    const limit = resolveData(minProperties, context)
    if (
      typeof value !== 'object' ||
      typeof limit !== 'number' ||
      Object.keys(value).length < limit
    ) {
      violations.push({ minProperties: limit, value })
    }
  }
  if (required) {
    const requiredProps = resolveData(required, context)
    if (
      typeof value !== 'object' ||
      !Array.isArray(requiredProps) ||
      requiredProps.some(property => !(property in value))
    ) {
      violations.push({ required: requiredProps, value })
    }
  }
  if (
    !!properties &&
    (typeof value !== 'object' ||
      Object.entries(properties).some(
        ([property, schema]) =>
          findViolations(value[property], schema, context, enrichProps)
            .length !== 0
      ))
  ) {
    violations.push({ properties, value })
  }
  // TODO patternProperties https://ajv.js.org/json-schema.html#patternproperties
  // TODO additionalProperties https://ajv.js.org/json-schema.html#additionalproperties
  // TODO dependentRequired https://ajv.js.org/json-schema.html#dependentrequired
  // TODO dependentSchemas https://ajv.js.org/json-schema.html#dependentschemas
  // TODO propertyNames https://ajv.js.org/json-schema.html#propertynames
  // TODO unevaluatedProperties https://ajv.js.org/json-schema.html#unevaluatedproperties
  // TODO discriminator https://ajv.js.org/json-schema.html#discriminator
  if (!!not && findViolations(value, not, context, enrichProps).length === 0) {
    violations.push({ not, value })
  }
  if (
    !!oneOf &&
    oneOf.filter(
      condition =>
        findViolations(value, condition, context, enrichProps).length === 0
    ).length !== 1
  ) {
    violations.push({ oneOf, value })
  }
  if (
    !!anyOf &&
    anyOf.every(
      condition =>
        findViolations(value, condition, context, enrichProps).length !== 0
    )
  ) {
    violations.push({ anyOf, value })
  }
  if (
    !!allOf &&
    allOf.some(
      condition =>
        findViolations(value, condition, context, enrichProps).length !== 0
    )
  ) {
    violations.push({ allOf, value })
  }
  if (condition) {
    const conditionMatched =
      findViolations(value, condition, context, enrichProps).length === 0
    if (conditionMatched) {
      conditionThen && enrichProps?.(conditionThen)
      if (
        conditionThen &&
        findViolations(value, conditionThen, context, enrichProps).length !== 0
      ) {
        violations.push({ then: conditionThen, value })
      }
    } else {
      conditionElse && enrichProps?.(conditionElse)
      if (
        conditionElse &&
        findViolations(value, conditionElse, context, enrichProps).length !== 0
      ) {
        violations.push({ else: conditionElse, value })
      }
    }
  }
  return violations
}

function resolveData(condition, context = {}) {
  if (typeof condition !== 'object' || !('$data' in condition)) {
    return condition
  }
  // TODO relative pointers
  const path = condition.$data
  const legs = path.slice(path.startsWith('#') ? 2 : 1).split('/')
  let value = context
  for (const leg of legs) {
    value = context[leg]
    if (typeof value !== 'object') {
      break
    }
    context = value
  }
  return value
}

function equals(a, b) {
  if (typeof a !== typeof b) {
    return false
  }
  if (typeof a !== 'object') {
    return a === b
  }
  const keysA = new Set(Object.keys(a))
  const keysB = new Set(Object.keys(b))
  if (keysA.size !== keysB.size) {
    return false
  }
  for (const key of keysA) {
    if (!equals(a[key], b[key])) {
      return false
    }
  }
  return true
}
