import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../../i18n/useLang';
import StaffShell from '../../../components/staff/StaffShell';
import SearchBar from '../../../components/SearchBar';
import { Skel } from '../../../components/staff/Skeleton';
import {
  setIngredientAvailability,
  deleteIngredient,
  setAddonAvailability,
  deleteAddon,
  setComponentGroupAvailability,
  deleteComponentGroup,
  removeExtraRelation,
} from '../../../api/admin';
import { useStaffData } from '../../../context/StaffDataContext';
import { MdTune, MdAdd, MdEdit, MdDelete, MdClose, MdExpandMore, MdExpandLess } from 'react-icons/md';
import styles from './extrasManagement.module.css';

const TABS = ['ingredients', 'addons', 'componentGroups'];

const TYPE_FOR = {
  ingredients:     'ingredient',
  addons:          'addon',
  componentGroups: 'componentgroup',
};

export default function ExtrasManagement() {
  const { t }        = useTranslation('extrasManagement');
  const local        = useLocalField();
  const navigate     = useNavigate();
  const [activeTab,  setActiveTab]   = useState('ingredients');
  const [expanded,   setExpanded]    = useState(new Set());
  const [tabSearch,  setTabSearch]   = useState({ ingredients: '', addons: '', componentGroups: '' });
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Extras (ingredients/addons/componentGroups) from shared cache.
  // Lazy-loaded on first page visit, then kept fresh by EXTRAS_UPDATED WS events.
  const { extras, refreshExtras, ensureExtras } = useStaffData();
  useEffect(() => { ensureExtras(); }, [ensureExtras]);
  const data    = extras || { ingredients: [], addons: [], componentGroups: [] };
  const loading = extras === null;
  const load    = refreshExtras;

  // ── Availability toggle ───────────────────────────────────────────────────
  async function toggleAvailable(item) {
    const id   = String(item._id);
    const next = !item.isAvailable;
    try {
      if (activeTab === 'ingredients') {
        await setIngredientAvailability(id, next);
        setData(prev => ({ ...prev, ingredients: prev.ingredients.map(i => String(i._id) === id ? { ...i, isAvailable: next } : i) }));
      } else if (activeTab === 'addons') {
        await setAddonAvailability(id, next);
        setData(prev => ({ ...prev, addons: prev.addons.map(a => String(a._id) === id ? { ...a, isAvailable: next } : a) }));
      } else {
        await setComponentGroupAvailability(id, next);
        setData(prev => ({ ...prev, componentGroups: prev.componentGroups.map(g => String(g._id) === id ? { ...g, isAvailable: next } : g) }));
      }
    } catch (err) { console.error('toggle availability error:', err); }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(item) {
    const id = String(item._id);
    try {
      if (activeTab === 'ingredients') {
        await deleteIngredient(id);
        setData(prev => ({ ...prev, ingredients: prev.ingredients.filter(i => String(i._id) !== id) }));
      } else if (activeTab === 'addons') {
        await deleteAddon(id);
        setData(prev => ({ ...prev, addons: prev.addons.filter(a => String(a._id) !== id) }));
      } else {
        await deleteComponentGroup(id);
        setData(prev => ({ ...prev, componentGroups: prev.componentGroups.filter(g => String(g._id) !== id) }));
      }
    } catch (err) {
      const extraError = err?.response?.data?.error;
      if (extraError?.code === 'EXTRA_IN_USE') {
        setConfirmDialog({
          type: 'deleteCascade',
          item,
          count: extraError?.data?.usedInCount || 0,
          onConfirm: async () => {
            if (activeTab === 'ingredients') await deleteIngredient(id, { force: true });
            else if (activeTab === 'addons') await deleteAddon(id, { force: true });
            else await deleteComponentGroup(id, { force: true });
            setData(prev => ({
              ...prev,
              ingredients:     activeTab === 'ingredients'     ? prev.ingredients.filter(i => String(i._id) !== id)     : prev.ingredients,
              addons:          activeTab === 'addons'          ? prev.addons.filter(a => String(a._id) !== id)          : prev.addons,
              componentGroups: activeTab === 'componentGroups' ? prev.componentGroups.filter(g => String(g._id) !== id) : prev.componentGroups,
            }));
            await load();
          },
        });
        return;
      }
      console.error('delete error:', err);
    }
  }

  // ── Expand (component groups) ─────────────────────────────────────────────
  function toggleExpand(id) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function handleDetachRelation(itemId, extraType, extraId) {
    try {
      await removeExtraRelation(extraType, extraId, itemId);
      await load();
    } catch (err) { console.error('remove relation error:', err); }
  }

  function renderUsageList(item, extraType) {
    const dishes = item.usedInDishes || [];
    if (!dishes.length) return <span className={styles.unusedBadge}>{t('unused')}</span>;
    const top = dishes.slice(0, 3);
    return (
      <div className={styles.usageList}>
        {top.map((d) => (
          <span key={String(d._id)} className={styles.dishBadge}>
            <span className={styles.dishName}>{local(d, 'name') || d.name}</span>
            <button
              className={styles.relationRemoveBtn}
              onClick={() => handleDetachRelation(String(d._id), extraType, String(item._id))}
              title={t('removeRelation')}
            >
              <MdClose />
            </button>
          </span>
        ))}
        {dishes.length > 3 && <span className={styles.moreText}>{t('andMore', { n: dishes.length - 3 })}</span>}
      </div>
    );
  }

  function AvailToggle({ item }) {
    return (
      <button
        className={`${styles.toggle} ${item.isAvailable ? styles.toggleOn : ''}`}
        onClick={() => toggleAvailable(item)}
        title={item.isAvailable ? t('markUnavailable') : t('markAvailable')}
      >
        <span className={styles.toggleThumb} />
      </button>
    );
  }

  // ── Filtered lists ────────────────────────────────────────────────────────
  // Search hits any language variant so users can type in either UA or EN.
  const norm    = (tabSearch[activeTab] || '').trim().toLowerCase();
  const hitName = (obj) =>
    (obj?.name || '').toLowerCase().includes(norm) ||
    (obj?.name_en || '').toLowerCase().includes(norm);
  const filteredIngredients    = data.ingredients.filter(i => !norm || hitName(i));
  const filteredAddons         = data.addons.filter(a => !norm || hitName(a));
  const filteredComponentGroups = data.componentGroups.filter(g => {
    if (!norm) return true;
    if (hitName(g)) return true;
    return (g.options || []).some(o => hitName(o));
  });

  function handleDeleteClick(item) {
    setConfirmDialog({
      type: 'delete',
      item,
      onConfirm: async () => { await handleDelete(item); },
    });
  }

  // ── Render ingredients ────────────────────────────────────────────────────
  function renderIngredients() {
    return (
      <>
        <table className={styles.table}>
          <thead>
            <tr className={styles.thead}>
              <th>{t('name')}</th>
              <th>{t('removable')}</th>
              <th>{t('usingTable')}</th>
              <th>{t('available')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredIngredients.length === 0 && (
              <tr><td colSpan={5} className={styles.noData}>{t('noData')}</td></tr>
            )}
            {filteredIngredients.map(item => {
              const id = String(item._id);
              return (
                <tr key={id} className={!item.isAvailable ? styles.unavailRow : ''}>
                  <td>{local(item, 'name') || item.name}</td>
                  <td>{item.isRemovable ? <span className={styles.badge}>{t('removable')}</span> : null}</td>
                  <td>{renderUsageList(item, 'ingredients')}</td>
                  <td><AvailToggle item={item} /></td>
                  <td className={styles.actions}>
                    <button
                      className={styles.iconBtn}
                      onClick={() => navigate(`/staff/extras/ingredient/${id}`)}
                      title={t('edit')}
                    >
                      <MdEdit />
                    </button>
                    <button
                      className={`${styles.iconBtn} ${styles.danger}`}
                      onClick={() => handleDeleteClick(item)}
                      title={t('delete')}
                    >
                      <MdDelete />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button className={styles.addBtn} onClick={() => navigate('/staff/extras/ingredient/new')}>
          <MdAdd /> {t('addIngredient')}
        </button>
      </>
    );
  }

  // ── Render addons ─────────────────────────────────────────────────────────
  function renderAddons() {
    return (
      <>
        <table className={styles.table}>
          <thead>
            <tr className={styles.thead}>
              <th>{t('name')}</th>
              <th>{t('price')}</th>
              <th>{t('usingTable')}</th>
              <th>{t('available')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredAddons.length === 0 && (
              <tr><td colSpan={5} className={styles.noData}>{t('noData')}</td></tr>
            )}
            {filteredAddons.map(item => {
              const id = String(item._id);
              return (
                <tr key={id} className={!item.isAvailable ? styles.unavailRow : ''}>
                  <td>{local(item, 'name') || item.name}</td>
                  <td>{item.price} ₴</td>
                  <td>{renderUsageList(item, 'addons')}</td>
                  <td><AvailToggle item={item} /></td>
                  <td className={styles.actions}>
                    <button
                      className={styles.iconBtn}
                      onClick={() => navigate(`/staff/extras/addon/${id}`)}
                      title={t('edit')}
                    >
                      <MdEdit />
                    </button>
                    <button
                      className={`${styles.iconBtn} ${styles.danger}`}
                      onClick={() => handleDeleteClick(item)}
                      title={t('delete')}
                    >
                      <MdDelete />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button className={styles.addBtn} onClick={() => navigate('/staff/extras/addon/new')}>
          <MdAdd /> {t('addAddon')}
        </button>
      </>
    );
  }

  // ── Render component groups ───────────────────────────────────────────────
  function renderComponentGroups() {
    return (
      <div className={styles.groupList}>
        {filteredComponentGroups.length === 0 && <p className={styles.noData}>{t('noData')}</p>}
        {filteredComponentGroups.map(group => {
          const id         = String(group._id);
          const isExpanded = expanded.has(id);
          return (
            <div key={id} className={`${styles.groupCard} ${!group.isAvailable ? styles.unavailCard : ''}`}>
              <div className={styles.groupHeader}>
                <span className={styles.groupName}>{local(group, 'name') || group.name}</span>
                <span className={styles.optsBadge}>
                  {t('optionsCount', {
                    count:    group.options?.length || 0,
                    position: t('position', { count: group.options?.length || 0 }),
                  })}
                </span>
                {group.isRequired && <span className={styles.badge}>{t('required')}</span>}
                <AvailToggle item={group} />
                <div className={styles.groupActions}>
                  <button
                    className={styles.iconBtn}
                    onClick={() => navigate(`/staff/extras/componentgroup/${id}`)}
                    title={t('editComponentGroup')}
                  >
                    <MdEdit />
                  </button>
                  <button
                    className={`${styles.iconBtn} ${styles.danger}`}
                    onClick={() => handleDeleteClick(group)}
                    title={t('delete')}
                  >
                    <MdDelete />
                  </button>
                  <button className={styles.iconBtn} onClick={() => toggleExpand(id)}>
                    {isExpanded ? <MdExpandLess /> : <MdExpandMore />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className={styles.optionsList}>
                  {(group.options || []).map((opt, idx) => {
                    const primary   = local(opt, 'name') || opt.name;
                    const secondary = opt.name && opt.name !== primary ? opt.name : null;
                    return (
                    <div key={String(opt._id || idx)} className={styles.optionRow}>
                      <span>{primary}</span>
                      {secondary && (
                        <span className={styles.optPrice}>/ {secondary}</span>
                      )}
                      {opt.priceModifier !== 0 && (
                        <span className={styles.optPrice}>{opt.priceModifier > 0 ? '+' : ''}{opt.priceModifier} ₴</span>
                      )}
                      {opt.isDefault && <span className={styles.badge}>{t('defaultOption')}</span>}
                    </div>
                    );
                  })}
                  <div className={styles.usageInline}>{renderUsageList(group, 'componentGroups')}</div>
                </div>
              )}
            </div>
          );
        })}
        <button className={styles.addBtn} onClick={() => navigate('/staff/extras/componentgroup/new')}>
          <MdAdd /> {t('titleNewComponentGroup')}
        </button>
      </div>
    );
  }

  if (loading) {
    // Plausible row variety: name + "removable" link + 1–3 dish-tag chips
    const SKEL_ROWS = [
      { name: 70,  removable: true, dishes: [80] },
      { name: 80,  removable: true, dishes: [80] },
      { name: 70,  removable: true, dishes: [80, 80, 80] },
      { name: 90,  removable: true, dishes: [80] },
      { name: 80,  removable: true, dishes: [80, 90, 80] },
      { name: 40,  removable: true, dishes: [80] },
      { name: 80,  removable: true, dishes: [80, 80] },
      { name: 70,  removable: true, dishes: [80, 90, 80] },
      { name: 60,  removable: true, dishes: [80, 80] },
      { name: 70,  removable: true, dishes: [80, 90] },
      { name: 110, removable: true, dishes: [80, 90, 80] },
      { name: 70,  removable: true, dishes: [80] },
      { name: 60,  removable: true, dishes: [80] },
      { name: 130, removable: true, dishes: [80] },
    ];
    return (
      <StaffShell title={<><MdTune /> {t('title')}</>}>
        <div className={styles.layout}>
          <div className={styles.tabs}>
            {TABS.map((tab, i) => (
              <button
                key={tab}
                className={`${styles.tab} ${i === 0 ? styles.tabActive : ''}`}
                disabled
              >
                {t(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`)}
              </button>
            ))}
          </div>

          <div className={styles.content}>
            {/* Search bar placeholder — same height as <SearchBar /> */}
            <Skel w="100%" h={44} r={10} />

            <table className={styles.table}>
              <thead>
                <tr className={styles.thead}>
                  <th>{t('name')}</th>
                  <th>{t('removable')}</th>
                  <th>{t('usingTable')}</th>
                  <th>{t('available')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {SKEL_ROWS.map((row, i) => (
                  <tr key={i}>
                    <td><Skel w={row.name} h={14} /></td>
                    <td>{row.removable && <Skel w={110} h={14} />}</td>
                    <td>
                      <div className={styles.usageList}>
                        {row.dishes.map((w, di) => (
                          <Skel key={di} w={w} h={18} r={5} />
                        ))}
                      </div>
                    </td>
                    <td><Skel w={36} h={20} r={10} /></td>
                    <td className={styles.actions}>
                      <Skel w={26} h={26} r={6} />
                      <Skel w={26} h={26} r={6} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </StaffShell>
    );
  }

  return (
    <StaffShell title={<><MdTune /> {t('title')}</>}>
      <div className={styles.layout}>
        <div className={styles.tabs}>
          {TABS.map(tab => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {t(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`)}
            </button>
          ))}
        </div>

        <div className={styles.content}>
          <SearchBar
            placeholder={t('searchPlaceholder')}
            value={tabSearch[activeTab] || ''}
            onChange={e => setTabSearch(prev => ({ ...prev, [activeTab]: e.target.value }))}
          />
          {loading
            ? null
            : activeTab === 'ingredients'    ? renderIngredients()
            : activeTab === 'addons'         ? renderAddons()
            : renderComponentGroups()}
        </div>
      </div>

      {confirmDialog && (
        <div className={styles.overlay} onClick={() => setConfirmDialog(null)}>
          <div className={styles.dialog} onClick={e => e.stopPropagation()}>
            <p className={styles.dialogTitle}>
              {confirmDialog.type === 'delete' ? t('confirmDelete') : t('confirmDeleteTitle')}
            </p>
            <p className={styles.dialogSub}>
              {(() => {
                const nm = confirmDialog.item ? (local(confirmDialog.item, 'name') || confirmDialog.item.name || '') : '';
                return confirmDialog.type === 'delete'
                  ? t('confirmDeleteItemSub', { name: nm })
                  : t('confirmDeleteSub', { name: nm, count: confirmDialog.count || 0 });
              })()}
            </p>
            <div className={styles.dialogActions}>
              <button className={styles.dialogCancel} onClick={() => setConfirmDialog(null)}>
                {t('cancel')}
              </button>
              <button
                className={styles.dialogConfirm}
                onClick={async () => {
                  try { await confirmDialog.onConfirm?.(); } finally { setConfirmDialog(null); }
                }}
              >
                {confirmDialog.type === 'delete' ? t('delete') : t('deleteCascade')}
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffShell>
  );
}
