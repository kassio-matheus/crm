import type { SalesDeal } from 'src/types/sales-deal';

export const sortDeals = (deals: SalesDeal[], sort: string): SalesDeal[] => {
  const date = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
  const compareDate = (a: string | null | undefined, b: string | null | undefined, direction = 1) => {
    const x = date(a); const y = date(b);
    if (x === null) return y === null ? 0 : 1;
    if (y === null) return -1;
    return (x - y) * direction;
  };
  return [...deals].sort((a, b) => {
    let result = 0;
    switch (sort) {
      case 'nameAsc': result = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base', numeric: true }); break;
      case 'nameDesc': result = b.name.localeCompare(a.name, 'pt-BR', { sensitivity: 'base', numeric: true }); break;
      case 'oldest': result = compareDate(a.rdCreatedAt ?? a.createdAt, b.rdCreatedAt ?? b.createdAt); break;
      case 'nextTask': result = compareDate(a.nextActivityAt, b.nextActivityAt); break;
      case 'closeDate': result = compareDate(a.closeDate, b.closeDate); break;
      case 'lastContact': result = compareDate(a.lastContactAt, b.lastContactAt, -1); break;
      case 'oldestContact': result = compareDate(a.lastContactAt, b.lastContactAt); break;
      case 'rating': result = (b.qualification ?? 0) - (a.qualification ?? 0); break;
      default: result = compareDate(a.rdCreatedAt ?? a.createdAt, b.rdCreatedAt ?? b.createdAt, -1);
    }
    return result || a.id.localeCompare(b.id);
  });
};
