// https://bost.ocks.org/mike/shuffle/
export function shuffle(array) {
  const copy = array.concat()
  let { length } = array
  let i

  while (length) {
    i = Math.floor(Math.random() * length--)
    const value = copy[length]
    copy[length] = copy[i]
    copy[i] = value
  }

  return copy
}
