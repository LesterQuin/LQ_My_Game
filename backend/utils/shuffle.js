/**
 * Shuffles an array using the Fisher-Yates algorithm.
 * Returns a new shuffled copy without mutating the original.
 * @template T
 * @param {T[]} array
 * @returns {T[]}
 */
export function shuffleArray(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
