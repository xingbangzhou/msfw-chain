import {MutableRefObject, Ref, useMemo} from 'react'

function setRef<T>(
  ref: MutableRefObject<T | null> | ((instance: T | null) => void) | null | undefined,
  value: T | null,
): void {
  if (typeof ref === 'function') {
    ref(value)
  } else if (ref) {
    ref.current = value
  }
}

export default function useForkRef<Instance>(
  refA: Ref<Instance> | null | undefined,
  refB: Ref<Instance> | null | undefined,
): Ref<Instance> | null {
  return useMemo(() => {
    if (refA == null && refB == null) {
      return null
    }
    return refValue => {
      setRef(refA, refValue)
      setRef(refB, refValue)
    }
  }, [refA, refB])
}
