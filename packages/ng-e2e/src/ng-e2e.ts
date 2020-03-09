export interface Add {
  a: number
  b: number
}
export function add({a, b}: Add) {
  const ret = a + b

  return ret
}
