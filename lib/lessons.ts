// Lesson id = book * 100 + số bài trong cuốn (cuốn 1: 1–15, cuốn 2: 101–115).

export const BOOK_NAMES: Record<number, string> = {
  1: 'Đương Đại 1',
  2: 'Đương Đại 2',
};

export function lessonNumber(id: number): number {
  return id % 100;
}

export function bookName(book: number): string {
  return BOOK_NAMES[book] ?? `Cuốn ${book}`;
}

export function groupByBook<T extends { book: number }>(lessons: T[]): { book: number; lessons: T[] }[] {
  const groups = new Map<number, T[]>();
  for (const l of lessons) {
    const list = groups.get(l.book) ?? [];
    list.push(l);
    groups.set(l.book, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([book, list]) => ({ book, lessons: list }));
}
