import { expect, it } from 'vitest';
import { importResourceLabel } from '../import-resource-label.util';
it('uses Portuguese CRM labels, including v1 aliases and deal details', () => {
  expect(importResourceLabel('organizations')).toBe('Empresas');
  expect(importResourceLabel('deal_pipelines')).toBe('Funis de vendas');
  expect(importResourceLabel('deal-files')).toBe('Arquivos das negociações');
  expect(importResourceLabel('unexpected')).toBe('Dados auxiliares');
});
