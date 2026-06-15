/**
 * Menu change detection helpers.
 *
 * Cart items store only IDs for addons and component-group options.
 * We compare those against fresh dish detail (raw API shape) to find:
 *   • dish removed / unavailable          → blocking, auto-removed from cart
 *   • addon removed                       → auto-removed, price recalculated
 *   • component option removed            → auto-replaced with group default
 *   • base / addon / option price changed → price recalculated, yellow tag
 *
 * All IDs in cart are normalised strings (no ObjectId wrappers).
 */

function nid(v) {
  if (!v) return '';
  if (typeof v === 'object') return String(v._id || v.id || '');
  return String(v);
}

/**
 * Diff a single cart item against the fresh (and optionally cached-old) dish.
 *
 * @param {object} cartItem   – item as stored in AppContext cart
 * @param {object|null} fresh – raw getDishDetail response, or null if not found
 * @param {object|null} old   – previously cached getDishDetail response (may be null)
 * @returns {{
 *   blocking: boolean,
 *   type: 'ok'|'dish_removed'|'dish_unavailable'|'modified',
 *   changes: object[],
 *   adjustedItem: object|null
 * }}
 */
export function diffCartItem(cartItem, fresh, old) {
  if (!fresh || fresh.isDeleted) {
    return { blocking: true, type: 'dish_removed', changes: [], adjustedItem: null };
  }
  if (fresh.isAvailable === false) {
    return { blocking: true, type: 'dish_unavailable', changes: [], adjustedItem: null };
  }

  const changes = [];

  // ── Lookup maps ───────────────────────────────────────────────────────────
  const freshBase  = fresh.basePrice ?? fresh.price ?? 0;

  const freshAddons = {};
  for (const a of fresh.addons || []) freshAddons[nid(a._id || a.id)] = a;

  const oldAddons = {};
  for (const a of old?.addons || []) oldAddons[nid(a._id || a.id)] = a;

  const freshGroups = {};
  for (const g of fresh.componentGroups || []) freshGroups[nid(g._id || g.id)] = g;

  const oldGroups = {};
  for (const g of old?.componentGroups || []) oldGroups[nid(g._id || g.id)] = g;

  // ── Addons ────────────────────────────────────────────────────────────────
  let addonTotal = 0;
  const newAddons = [];

  for (const rawId of cartItem.selectedAddons || []) {
    const id = String(rawId);
    const fa = freshAddons[id];

    if (!fa) {
      const oa = oldAddons[id];
      changes.push({ kind: 'addon_removed', name: oa?.name || id, name_en: oa?.name_en || oa?.name || id });
    } else {
      newAddons.push(id);
      addonTotal += fa.price || 0;

      const oa = oldAddons[id];
      if (oa && Math.abs((fa.price || 0) - (oa.price || 0)) > 0.01) {
        changes.push({
          kind: 'addon_price',
          name: fa.name, name_en: fa.name_en || fa.name,
          oldPrice: oa.price || 0, newPrice: fa.price || 0,
        });
      }
    }
  }

  // ── Component groups ──────────────────────────────────────────────────────
  let groupTotal = 0;
  const newGroups = {};

  for (const [rawGid, rawOid] of Object.entries(cartItem.componentGroupSelections || {})) {
    const gid = String(rawGid);
    const oid = String(rawOid);
    const fg  = freshGroups[gid];

    if (!fg) {
      const og = oldGroups[gid];
      changes.push({ kind: 'group_removed', name: og?.name || gid, name_en: og?.name_en || og?.name || gid });
      continue;
    }

    const freshOpts = {};
    for (const o of fg.options || []) freshOpts[nid(o._id || o.id)] = o;

    const og       = oldGroups[gid];
    const oldOpts  = {};
    for (const o of og?.options || []) oldOpts[nid(o._id || o.id)] = o;

    const fo = freshOpts[oid];

    if (!fo) {
      const oo       = oldOpts[oid];
      const fallback = fg.options?.find(o => o.isDefault) ?? fg.options?.[0];
      changes.push({
        kind: 'option_removed',
        groupName: fg.name, groupName_en: fg.name_en || fg.name,
        name: oo?.name || oid, name_en: oo?.name_en || oo?.name || oid,
        fallbackName: fallback?.name, fallbackName_en: fallback?.name_en || fallback?.name,
      });
      if (fallback) {
        const fid = nid(fallback._id || fallback.id);
        newGroups[gid] = fid;
        groupTotal += fallback.priceModifier || 0;
      }
    } else {
      newGroups[gid] = oid;
      groupTotal += fo.priceModifier || 0;

      const oo = oldOpts[oid];
      if (oo && Math.abs((fo.priceModifier || 0) - (oo.priceModifier || 0)) > 0.01) {
        changes.push({
          kind: 'option_price',
          groupName: fg.name, groupName_en: fg.name_en || fg.name,
          name: fo.name, name_en: fo.name_en || fo.name,
          oldPrice: oo.priceModifier || 0, newPrice: fo.priceModifier || 0,
        });
      }
    }
  }

  // ── Base price ────────────────────────────────────────────────────────────
  const oldBase = old?.basePrice ?? old?.price ?? null;
  if (oldBase !== null && Math.abs(freshBase - oldBase) > 0.01) {
    changes.push({ kind: 'base_price', oldPrice: oldBase, newPrice: freshBase });
  }

  const newUnitPrice = freshBase + addonTotal + groupTotal;
  const priceChanged = Math.abs(newUnitPrice - cartItem.price) > 0.01;

  // If price changed but we couldn't attribute it (no old dish cached), add generic entry
  if (priceChanged && oldBase === null && !changes.some(c => c.kind.includes('price'))) {
    changes.push({ kind: 'base_price', oldPrice: cartItem.price, newPrice: newUnitPrice });
  }

  const adjustedItem = (changes.length > 0 || priceChanged)
    ? { ...cartItem, price: newUnitPrice, selectedAddons: newAddons, componentGroupSelections: newGroups }
    : cartItem;

  return {
    blocking: false,
    type: changes.length > 0 ? 'modified' : 'ok',
    changes,
    adjustedItem,
  };
}
