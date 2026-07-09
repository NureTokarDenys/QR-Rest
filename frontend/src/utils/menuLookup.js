/** Find a menu item by id across all loaded categories. */
export function findMenuItemById(categories, id) {
  if (!id) return null;
  const sid = String(id);
  for (const cat of categories || []) {
    const hit = (cat.items || []).find(it => String(it._id || it.id) === sid);
    if (hit) return hit;
  }
  return null;
}
