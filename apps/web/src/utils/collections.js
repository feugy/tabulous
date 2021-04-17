// https://bost.ocks.org/mike/shuffle/
export function shuffle(array = []) {
  const copy = Array.isArray(array) ? [...array] : []
  let { length } = copy
  let i

  while (length) {
    i = Math.floor(Math.random() * length--)
    const value = copy[length]
    copy[length] = copy[i]
    copy[i] = value
  }

  return copy
}
