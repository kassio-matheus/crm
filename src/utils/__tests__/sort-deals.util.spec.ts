import { describe, expect, it } from 'vitest';
import { sortDeals } from '../sort-deals.util';
import type { SalesDeal } from 'src/types/sales-deal';
const deals: SalesDeal[] = [
  { id: 'a', name: 'Árvore', createdAt: '2026-02-01', updatedAt: '2026-02-01', stage: 'NEW', rdCreatedAt: '2020-01-01', qualification: 5, nextActivityAt: null },
  { id: 'b', name: 'Banana', createdAt: '2026-01-01', updatedAt: '2026-01-01', stage: 'NEW', qualification: 1, nextActivityAt: '2026-01-10' },
];
describe('sortDeals', () => {
  it.each([['nameAsc', 'a'], ['nameDesc', 'b'], ['newest', 'b'], ['oldest', 'a'], ['rating', 'a'], ['nextTask', 'b']])('sorts by %s', (sort, first) => expect(sortDeals(deals, sort)[0].id).toBe(first));
  it('keeps missing dates last in both directions', () => { const data = [{ ...deals[0], lastContactAt: null }, { ...deals[1], lastContactAt: '2026-01-01' }]; expect(sortDeals(data, 'lastContact')[0].id).toBe('b'); expect(sortDeals(data, 'oldestContact')[0].id).toBe('b'); });
  it('does not mutate input and uses stable tie breaking', () => { expect(sortDeals([...deals].reverse(), 'closeDate').map(d => d.id)).toEqual(['a', 'b']); expect(deals[0].id).toBe('a'); });
});
