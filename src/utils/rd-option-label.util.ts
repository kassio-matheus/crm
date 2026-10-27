import { sourceId } from 'src/utils/source-id.util';

/** Twenty enum labels cannot contain commas, be empty, or exceed 63 UTF-16 units. */
export const rdOptionLabel = (label: string): string => {
  const readable = label.replace(/,/g, ';').trim();
  if (readable && readable.length <= 63) return readable;
  const suffix = sourceId(`rd-option-label:${label}`).slice(0, 8);
  // Array.from avoids cutting a surrogate pair while respecting Twenty's length check.
  let prefix = '';
  for (const character of readable) {
    if (prefix.length + character.length > 51) break;
    prefix += character;
  }
  return `${prefix.trimEnd() || 'RD'}… [${suffix}]`;
};
