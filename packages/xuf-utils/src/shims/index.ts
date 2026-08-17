const objectPrototype = Object.prototype

const defineProperty = Object.defineProperty

export function addHiddenProp(object: any, propName: PropertyKey, value: any) {
  defineProperty(object, propName, {
    enumerable: false,
    writable: true,
    configurable: true,
    value,
  })
}

export function hasProp(target: any, prop: PropertyKey): boolean {
  return objectPrototype.hasOwnProperty.call(target, prop)
}
