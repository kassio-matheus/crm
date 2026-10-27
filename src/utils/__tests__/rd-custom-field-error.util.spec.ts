import { expect, it } from 'vitest';
import { rdCustomFieldError } from '../rd-custom-field-error.util';

it('returns a bounded field identifier and known GraphQL error code', () => {
  const name = `rdCustom${'a'.repeat(32)}`;
  expect(
    rdCustomFieldError(
      { errors: [{ extensions: { code: 'FORBIDDEN' } }] },
      name,
    ).message,
  ).toContain(`${name} (FORBIDDEN)`);
});

it.each([
  null,
  new Error('token=SECRET'),
  { errors: 'SECRET' },
  {
    errors: [
      { message: 'SECRET', extensions: { code: 'SECRET', response: 'SECRET' } },
    ],
  },
])(
  'does not expose foreign errors or arbitrary field contents: %s',
  (error) => {
    const result = rdCustomFieldError(error, 'SECRET');
    expect(result.message).toContain('custom field (UNKNOWN)');
    expect(result.message).not.toContain('SECRET');
  },
);
