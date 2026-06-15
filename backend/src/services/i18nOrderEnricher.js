/**
 * Backend-side helpers that take raw OrderItem documents (lean) and inject
 * `name_en` flat fields for the dish + every nested snapshot (ingredients,
 * addons, component group + option). The /staff/map endpoint already does
 * this for dish names — these helpers generalise that pattern so all order
 * endpoints can return both `name` and `name_en` in a single response.
 *
 * The frontend then resolves the active language at render time via the
 * useLocalField hook — no per-language refetch needed.
 */

const MenuItem = require('../models/MenuItem');

/**
 * Resolve the English name of a MenuItem. Order of preference:
 *   1. Pattern-B translations object (translations.en.name.value)
 *   2. Flat `name_en` if present (not on MenuItem top-level today, but safe)
 *   3. Source `name` as a last-resort fallback
 */
function menuItemNameEn(mi) {
  if (!mi) return '';
  return (
    mi.translations?.en?.name?.value
    || mi.name_en
    || mi.name
    || ''
  );
}

/**
 * Load all MenuItems referenced by an array of OrderItem documents and return
 * a Map keyed by stringified MenuItem _id. Each entry holds the slim subset
 * we need to enrich orders: name, translations, ingredients/addons/component
 * groups (with their bilingual sub-schema fields).
 */
async function loadMenuItemMapFor(orderItems) {
  const ids = [...new Set(
    (orderItems || [])
      .map(i => {
        const raw = i.menuItemId;
        if (!raw) return null;
        // menuItemId may be a populated object or a raw ObjectId
        return typeof raw === 'object' && raw._id ? String(raw._id) : String(raw);
      })
      .filter(Boolean)
  )];
  if (!ids.length) return new Map();
  const docs = await MenuItem.find({ _id: { $in: ids } })
    .select('name translations categoryId ingredients addons componentGroups')
    .lean();
  return new Map(docs.map(d => [String(d._id), d]));
}

/**
 * Enrich a single OrderItem (lean) with `name_en` fields. Returns a new
 * object — does not mutate the input.
 *
 * Expected output shape (matches what /staff/map already returns):
 *   menuItemId: { _id, name, name_en, categoryId? }
 *   excludedIngredients: [{ _id, name, name_en }]
 *   addons:               [{ _id, name, name_en, price?, quantity? }]
 *   componentGroupChoices:
 *     [{ groupId: { _id, name, name_en }, optionId: { _id, name, name_en },
 *        groupName, optionName, priceModifier }]
 */
function enrichOrderItem(item, menuMap) {
  if (!item) return item;

  // Figure out the MenuItem id whether menuItemId is populated or raw
  const rawMi = item.menuItemId;
  const miId  = rawMi && typeof rawMi === 'object' && rawMi._id
    ? String(rawMi._id)
    : (rawMi ? String(rawMi) : null);
  const mi    = miId ? menuMap.get(miId) : null;

  // ── Dish name (menuItemId object) ──────────────────────────────────────
  const dishName    = mi?.name || (typeof rawMi === 'object' ? rawMi?.name : null) || item.menuItemName || '';
  const dishNameEn  = menuItemNameEn(mi) || (typeof rawMi === 'object' ? rawMi?.name_en : '') || dishName;
  const menuItemIdOut = {
    _id:        miId || (typeof rawMi === 'object' ? rawMi?._id : rawMi),
    name:       dishName,
    name_en:    dishNameEn,
    categoryId: mi?.categoryId || (typeof rawMi === 'object' ? rawMi?.categoryId : undefined),
  };

  // ── Sub-schema lookup maps from the MenuItem (for name_en injection) ───
  const ingMap = new Map((mi?.ingredients || []).map(x => [String(x._id), x]));
  const aoMap  = new Map((mi?.addons      || []).map(x => [String(x._id), x]));
  const cgMap  = new Map();
  for (const g of (mi?.componentGroups || [])) {
    const optMap = new Map((g.options || []).map(o => [String(o._id), o]));
    cgMap.set(String(g._id), { group: g, optMap });
  }

  // ── Excluded ingredients ───────────────────────────────────────────────
  const excludedIngredients = (item.excludedIngredients || []).map(x => {
    const live = ingMap.get(String(x._id));
    return {
      _id:     x._id,
      name:    x.name || live?.name || '',
      name_en: live?.name_en || x.name_en || x.name || '',
    };
  });

  // ── Addons ─────────────────────────────────────────────────────────────
  const addons = (item.addons || []).map(a => {
    const live = aoMap.get(String(a._id));
    return {
      _id:      a._id,
      name:     a.name || live?.name || '',
      name_en:  live?.name_en || a.name_en || a.name || '',
      price:    a.price,
      quantity: a.quantity,
    };
  });

  // ── Component group choices ────────────────────────────────────────────
  const componentGroupChoices = (item.componentGroupChoices || []).map(c => {
    const grp     = cgMap.get(String(c.groupId));
    const opt     = grp?.optMap?.get(String(c.optionId));
    const grpName = c.groupName  || grp?.group?.name    || '';
    const grpEn   = grp?.group?.name_en || c.groupName  || '';
    const optName = c.optionName || opt?.name           || '';
    const optEn   = opt?.name_en || c.optionName        || '';
    return {
      // Keep the original snapshot fields for backwards compatibility.
      groupName:     grpName,
      optionName:    optName,
      priceModifier: c.priceModifier,
      // Populated-object shape so the frontend's `local(c.groupId, 'name')`
      // pattern resolves the right language at render time.
      groupId:  { _id: c.groupId,  name: grpName, name_en: grpEn },
      optionId: { _id: c.optionId, name: optName, name_en: optEn },
    };
  });

  return {
    ...item,
    menuItemId: menuItemIdOut,
    excludedIngredients,
    addons,
    componentGroupChoices,
  };
}

/**
 * Enrich an array of OrderItems in one shot: fetches the MenuItem map then
 * maps each item through enrichOrderItem.
 */
async function enrichOrderItems(items) {
  if (!items?.length) return [];
  const menuMap = await loadMenuItemMapFor(items);
  return items.map(i => enrichOrderItem(i, menuMap));
}

module.exports = {
  enrichOrderItem,
  enrichOrderItems,
  loadMenuItemMapFor,
  menuItemNameEn,
};
