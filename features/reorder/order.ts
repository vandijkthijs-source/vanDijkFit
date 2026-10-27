/** Only IDs move; reconcile against the latest data before committing. */
export function moveId(ids: readonly string[], id: string, index: number): string[] {
  const next = ids.filter(value => value !== id);
  if (!ids.includes(id)) return [...ids];
  next.splice(Math.max(0, Math.min(index, next.length)), 0, id);
  return next;
}
export function reconcileOrder(preview: readonly string[], current: readonly string[]): string[] {
  const existing = new Set(current);
  return [...new Set([...preview.filter(id => existing.has(id)), ...current])];
}
export function slots(ids: readonly string[], heights: Record<string, number>): Record<string, number> {
  let y = 0;
  return Object.fromEntries(ids.map(id => {
    const top = y;
    y += heights[id] ?? 0;
    return [id, top];
  }));
}
export function insertionOrder(ids: string[], id: string, top: number, heights: Record<string, number>): string[] {
  let next = [...ids];
  let index = next.indexOf(id);
  if (index < 0) return next;
  let positions = slots(next, heights);
  while (index < next.length - 1 && top + heights[id] > positions[next[index + 1]] + heights[next[index + 1]] / 2 + 6) {
    next = moveId(next, id, ++index);
    positions = slots(next, heights);
  }
  while (index > 0 && top < positions[next[index - 1]] + heights[next[index - 1]] / 2 - 6) {
    next = moveId(next, id, --index);
    positions = slots(next, heights);
  }
  return next;
}

/** Rebase onto measured compact rows without moving the picked-up card on screen. */
export function foldedDragLayout(
  ids: readonly string[], heights: Record<string, number>, activeId: string,
  draggedTop: number, scrollOffset: number,
) {
  const compact = slots(ids, heights);
  const requestedScroll = scrollOffset + compact[activeId] - draggedTop;
  const paddingTop = Math.max(0, -requestedScroll);
  const origin = Object.fromEntries(ids.map(id => [id, compact[id] + paddingTop]));
  return { origin, paddingTop, scrollOffset: Math.max(0, requestedScroll) };
}
