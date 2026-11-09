// Match common stored phone formats without sending a different person's
// name search to the phone query. Twenty stores the country code separately.
export const contactPhoneFilter = (input) => {
  const text = input.trim();
  if (!/^\+?[\d().\s-]+$/.test(text)) return;
  const digits = text.replace(/\D/g, '');
  if (digits.length < 4 || digits.length > 15) return;

  const national =
    digits.startsWith('55') && [12, 13].includes(digits.length)
      ? digits.slice(2)
      : digits;
  const variants = new Set([digits, national, text.replace(/^\+/, '')]);
  const local = [10, 11].includes(national.length)
    ? national.slice(2)
    : national;
  if ([8, 9].includes(local.length)) {
    const formatted = `${local.slice(0, -4)}-${local.slice(-4)}`;
    if (local === national) variants.add(formatted);
    else {
      const area = national.slice(0, 2);
      variants.add(`${area} ${formatted}`);
      variants.add(`(${area}) ${formatted}`);
      variants.add(`${area}-${formatted}`);
      variants.add(`${area} ${local}`);
    }
  }
  return {
    or: [...variants].flatMap((phone) => [
      { phones: { primaryPhoneNumber: { ilike: `%${phone}%` } } },
      { phones: { additionalPhones: { ilike: `%${phone}%` } } },
    ]),
  };
};
