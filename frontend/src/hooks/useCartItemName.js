import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { useMenuContext } from '../context/MenuContext';
import { bilingualFromEntity } from '../i18n/langs';
import { useLocalField } from '../i18n/useLang';
import { findMenuItemById } from '../utils/menuLookup';

/**
 * Resolve a cart item's dish name for the active UI language.
 * Prefers the live menu cache (refetched on language change); falls back to
 * the bilingual fields stored on the cart item.
 */
export function resolveCartItemName(item, categories, local) {
  const menuItem = findMenuItemById(categories, item?.id);
  if (menuItem?.name) return menuItem.name;
  return local(item, 'name');
}

export function useCartItemName(item) {
  const { categories } = useMenuContext();
  const local = useLocalField();
  return useMemo(
    () => resolveCartItemName(item, categories, local),
    [item, categories, local],
  );
}

/**
 * Keep persisted cart snapshots bilingual when the menu cache reloads after
 * a language switch (or on first load with items restored from localStorage).
 */
export function useSyncCartItemNames() {
  const { cart, replaceCart } = useApp();
  const { categories } = useMenuContext();
  const { i18n } = useTranslation();

  useEffect(() => {
    if (!cart.length || !categories.length) return;

    let changed = false;
    const next = cart.map(item => {
      const menuItem = findMenuItemById(categories, item.id);
      if (!menuItem) return item;
      const { name, name_en } = bilingualFromEntity(menuItem, 'name');
      if (item.name === name && item.name_en === name_en) return item;
      changed = true;
      return { ...item, name, name_en };
    });

    if (changed) replaceCart(next);
  }, [categories, i18n.language]); // eslint-disable-line react-hooks/exhaustive-deps
}
