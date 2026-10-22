// Twenty v2.50.1: ViewPickerOptionDropdown.canEditView, built from upstream
// 1dccdfc5ad33bf11015064380e78eddcf0e69340. Keep the existing permission rule.
export const patchPicker = (source) => {
  const original = 'v=w||o.visibility===ee.UNLISTED,x=p.find';
  const replacement =
    'v=!(o.type==="KANBAN"&&o.icon==="IconLock")&&(w||o.visibility===ee.UNLISTED),x=p.find';
  if (
    source.split(original).length !== 2 ||
    !source.includes('view-picker-options-${o.id}')
  )
    throw new Error(
      'Unsupported Twenty view picker; review the upstream source before updating.',
    );
  return source.replace(original, replacement);
};
