import { describe, expect, it } from 'vitest';
import { buildNativeSalesQuery } from '../build-native-sales-query.util';
import type { NativeSalesFilters } from 'src/types/native-sales-filters';
const defaults: NativeSalesFilters = {
  pipelineId: '',
  ownerId: '',
  status: 'ALL',
  sort: 'newest',
  mode: 'board',
};
const views = { board: 'native', pipelineBoard: 'pipeline', list: 'list' };
describe('native sales URL filters', () => {
  it('opens the native board and explicitly clears previous filters', () => {
    const q = buildNativeSalesQuery(defaults, views);
    expect(q.viewId).toBe('native');
    expect(q['filterGroup[filters][0][field]']).toBe('id');
    expect(q['filterGroup[filters][0][op]']).toBe('IS_NOT_EMPTY');
    expect(q['sort[createdAt]']).toBe('DESC');
  });
  it('uses relation IDs for the selected pipeline and owner', () => {
    const q = buildNativeSalesQuery(
      { ...defaults, pipelineId: 'p', ownerId: 'u' },
      views,
    );
    expect(q.viewId).toBe('pipeline');
    expect(q['filterGroup[filters][0][value]']).toBe('["p"]');
    expect(q['filterGroup[filters][1][value]']).toBe('["u"]');
    expect(q['sort[rdCreatedAt]']).toBe('DESC');
  });
  it('opens a native list with unassigned owners', () => {
    const q = buildNativeSalesQuery(
      { ...defaults, mode: 'list', ownerId: 'UNASSIGNED' },
      views,
    );
    expect(q.viewId).toBe('list');
    expect(q['filterGroup[filters][0][op]']).toBe('IS_EMPTY');
  });
  it.each(['ONGOING', 'WON'] as const)(
    'includes explicit and legacy %s without deep URL groups',
    (status) => {
      const q = buildNativeSalesQuery({ ...defaults, status }, views);
      expect(q['filterGroup[groups][0][filters][0][value]']).toBe(
        JSON.stringify([status]),
      );
      expect(q['filterGroup[groups][1][filters][1][op]']).toBe(
        status === 'WON' ? 'IS' : 'IS_NOT',
      );
      expect(
        Object.keys(q).every((key) => (key.match(/\[/g) || []).length <= 5),
      ).toBe(true);
    },
  );
  it.each(['PAUSED', 'LOST'] as const)(
    'filters %s independently of the stage',
    (status) => {
      const q = buildNativeSalesQuery({ ...defaults, status }, views);
      expect(q['filterGroup[filters][0][field]']).toBe('dealStatus');
      expect(q['filterGroup[filters][0][value]']).toBe(
        JSON.stringify([status]),
      );
    },
  );
  it('includes legacy records when filtering not paused', () => {
    const q = buildNativeSalesQuery(
      { ...defaults, status: 'NOT_PAUSED' },
      views,
    );
    expect(q['filterGroup[groups][0][filters][1][op]']).toBe('IS_EMPTY');
  });
  it.each([
    ['nameAsc', 'name', 'ASC'],
    ['nameDesc', 'name', 'DESC'],
    ['oldest', 'createdAt', 'ASC'],
    ['nextTask', 'nextActivityAt', 'ASC'],
    ['closeDate', 'closeDate', 'ASC'],
    ['lastContact', 'lastContactAt', 'DESC'],
    ['oldestContact', 'lastContactAt', 'ASC'],
    ['rating', 'qualification', 'DESC'],
  ])('delegates %s ordering to Twenty', (sort, field, direction) => {
    expect(
      buildNativeSalesQuery({ ...defaults, sort }, views)[`sort[${field}]`],
    ).toBe(direction);
  });
  it('encodes special characters as a filter value, never as URL structure', () => {
    const id = 'a&sort[name]=DESC';
    const q = buildNativeSalesQuery({ ...defaults, pipelineId: id }, views);
    expect(q['filterGroup[filters][0][value]']).toBe(JSON.stringify([id]));
    expect(q['sort[name]']).toBeUndefined();
  });
});

it('uses the selected native pipeline view, including its empty ordered stages', () => {
  expect(
    buildNativeSalesQuery(
      { ...defaults, pipelineId: 'p' },
      { ...views, pipelineViews: { p: 'pipeline-view' } },
    ).viewId,
  ).toBe('pipeline-view');
});
