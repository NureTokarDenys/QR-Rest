import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import {
  getExtras,
  createIngredient, updateIngredient, deleteIngredient, setIngredientAvailability,
  createAddon,      updateAddon,      deleteAddon,      setAddonAvailability,
  deleteComponentGroup, setComponentGroupAvailability,
} from '../../../api/admin';
import { MdTune, MdAdd, MdEdit, MdDelete, MdCheck, MdClose, MdExpandMore, MdExpandLess } from 'react-icons/md';
import styles from './extrasManagement.module.css';

const TABS = ['ingredients', 'addons', 'componentGroups'];

export default function ExtrasManagement() {
  const { t }       = useTranslation('extrasManagement');
  const [activeTab, setActiveTab]   = useState('ingredients');
  const [data,      setData]        = useState({ ingredients: [], addons: [], componentGroups: [] });
  const [loading,   setLoading]     = useState(true);
  const [editingId, setEditingId]   = useState(null);
  const [editForm,  setEditForm]    = useState({});
  const [addForm,   setAddForm]     = useState(null);
  const [expanded,  setExpanded]    = useState(new Set());

  const load = useCallback(async () => {
    try {
      const d = await getExtras();
      if (d) setData(d);
    } catch (err) {
      console.error('getExtras error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Availability toggle ───────────────────────────────────────────────────
  async function toggleAvailable(item) {
    const id = String(item._id);
    const next = !item.isAvailable;
    try {
      if (activeTab === 'ingredients') {
        await setIngredientAvailability(id, next);
        setData(prev => ({ ...prev, ingredients: prev.ingredients.map(i => String(i._id) === id ? { ...i, isAvailable: next } : i) }));
      } else if (activeTab === 'addons') {
        await setAddonAvailability(id, next);
        setData(prev => ({ ...prev, addons: prev.addons.map(a => String(a._id) === id ? { ...a, isAvailable: next } : a) }));
      } else if (activeTab === 'componentGroups') {
        await setComponentGroupAvailability(id, next);
        setData(prev => ({ ...prev, componentGroups: prev.componentGroups.map(g => String(g._id) === id ? { ...g, isAvailable: next } : g) }));
      }
    } catch (err) { console.error('toggle availability error:', err); }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  function startEdit(item) {
    setEditingId(String(item._id));
    setEditForm({ name: item.name, isRemovable: item.isRemovable ?? true, price: item.price ?? 0 });
    setAddForm(null);
  }
  function cancelEdit() { setEditingId(null); setEditForm({}); }

  async function saveEdit(item) {
    const id = String(item._id);
    try {
      if (activeTab === 'ingredients') {
        await updateIngredient(id, { name: editForm.name, isRemovable: editForm.isRemovable });
        setData(prev => ({ ...prev, ingredients: prev.ingredients.map(i => String(i._id) === id ? { ...i, name: editForm.name, isRemovable: editForm.isRemovable } : i) }));
      } else if (activeTab === 'addons') {
        await updateAddon(id, { name: editForm.name, price: Number(editForm.price) });
        setData(prev => ({ ...prev, addons: prev.addons.map(a => String(a._id) === id ? { ...a, name: editForm.name, price: Number(editForm.price) } : a) }));
      }
      setEditingId(null);
    } catch (err) { console.error('save edit error:', err); }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(item) {
    if (!window.confirm(t('confirmDelete'))) return;
    const id = String(item._id);
    try {
      if (activeTab === 'ingredients') {
        await deleteIngredient(id);
        setData(prev => ({ ...prev, ingredients: prev.ingredients.filter(i => String(i._id) !== id) }));
      } else if (activeTab === 'addons') {
        await deleteAddon(id);
        setData(prev => ({ ...prev, addons: prev.addons.filter(a => String(a._id) !== id) }));
      } else if (activeTab === 'componentGroups') {
        await deleteComponentGroup(id);
        setData(prev => ({ ...prev, componentGroups: prev.componentGroups.filter(g => String(g._id) !== id) }));
      }
    } catch (err) { console.error('delete error:', err); }
  }

  // ── Add ───────────────────────────────────────────────────────────────────
  function openAdd() { setAddForm({ name: '', isRemovable: true, price: 0 }); setEditingId(null); }
  function cancelAdd() { setAddForm(null); }

  async function saveAdd() {
    if (!addForm.name.trim()) return;
    try {
      if (activeTab === 'ingredients') {
        const created = await createIngredient({ name: addForm.name.trim(), isRemovable: addForm.isRemovable });
        setData(prev => ({ ...prev, ingredients: [...prev.ingredients, { ...created, usedInDishes: [] }] }));
      } else if (activeTab === 'addons') {
        const created = await createAddon({ name: addForm.name.trim(), price: Number(addForm.price) });
        setData(prev => ({ ...prev, addons: [...prev.addons, { ...created, usedInDishes: [] }] }));
      }
      setAddForm(null);
    } catch (err) { console.error('add error:', err); }
  }

  // ── Expand (component groups) ─────────────────────────────────────────────
  function toggleExpand(id) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function AvailToggle({ item }) {
    return (
      <button
        className={`${styles.availBtn} ${item.isAvailable ? styles.availOn : styles.availOff}`}
        onClick={() => toggleAvailable(item)}
        title={item.isAvailable ? t('markUnavailable') : t('markAvailable')}
      >
        {item.isAvailable ? t('available') : t('unavailable')}
      </button>
    );
  }

  function UsageBadge({ dishes }) {
    if (!dishes?.length) return <span className={styles.unusedBadge}>{t('unused')}</span>;
    return <span className={styles.usageBadge}>{t('usedIn', { n: dishes.length })}</span>;
  }

  function renderIngredients() {
    return (
      <>
        <table className={styles.table}>
          <thead>
            <tr className={styles.thead}>
              <th>{t('name')}</th>
              <th>{t('removable')}</th>
              <th>{t('usage')}</th>
              <th>{t('available')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {data.ingredients.length === 0 && (
              <tr><td colSpan={5} className={styles.noData}>{t('noData')}</td></tr>
            )}
            {data.ingredients.map(item => {
              const id = String(item._id);
              const isEditing = editingId === id;
              return (
                <tr key={id} className={`${isEditing ? styles.editRow : ''} ${!item.isAvailable ? styles.unavailRow : ''}`}>
                  <td>
                    {isEditing
                      ? <input className={styles.inlineInput} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                      : item.name}
                  </td>
                  <td>
                    {isEditing
                      ? <input type="checkbox" checked={editForm.isRemovable} onChange={e => setEditForm(f => ({ ...f, isRemovable: e.target.checked }))} />
                      : item.isRemovable ? <span className={styles.badge}>{t('removable')}</span> : null}
                  </td>
                  <td><UsageBadge dishes={item.usedInDishes} /></td>
                  <td><AvailToggle item={item} /></td>
                  <td className={styles.actions}>
                    {isEditing ? (
                      <>
                        <button className={styles.iconBtn} onClick={() => saveEdit(item)}><MdCheck /></button>
                        <button className={styles.iconBtn} onClick={cancelEdit}><MdClose /></button>
                      </>
                    ) : (
                      <>
                        <button className={styles.iconBtn} onClick={() => startEdit(item)} title={t('edit')}><MdEdit /></button>
                        <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => handleDelete(item)} title={t('delete')}><MdDelete /></button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {renderAddRow('isRemovable')}
      </>
    );
  }

  function renderAddons() {
    return (
      <>
        <table className={styles.table}>
          <thead>
            <tr className={styles.thead}>
              <th>{t('name')}</th>
              <th>{t('price')}</th>
              <th>{t('usage')}</th>
              <th>{t('available')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {data.addons.length === 0 && (
              <tr><td colSpan={5} className={styles.noData}>{t('noData')}</td></tr>
            )}
            {data.addons.map(item => {
              const id = String(item._id);
              const isEditing = editingId === id;
              return (
                <tr key={id} className={`${isEditing ? styles.editRow : ''} ${!item.isAvailable ? styles.unavailRow : ''}`}>
                  <td>
                    {isEditing
                      ? <input className={styles.inlineInput} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                      : item.name}
                  </td>
                  <td>
                    {isEditing
                      ? <input className={styles.inlineInput} style={{ width: 80 }} type="number" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} />
                      : item.price}
                  </td>
                  <td><UsageBadge dishes={item.usedInDishes} /></td>
                  <td><AvailToggle item={item} /></td>
                  <td className={styles.actions}>
                    {isEditing ? (
                      <>
                        <button className={styles.iconBtn} onClick={() => saveEdit(item)}><MdCheck /></button>
                        <button className={styles.iconBtn} onClick={cancelEdit}><MdClose /></button>
                      </>
                    ) : (
                      <>
                        <button className={styles.iconBtn} onClick={() => startEdit(item)} title={t('edit')}><MdEdit /></button>
                        <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => handleDelete(item)} title={t('delete')}><MdDelete /></button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {renderAddRow('price')}
      </>
    );
  }

  function renderComponentGroups() {
    return (
      <div className={styles.groupList}>
        {data.componentGroups.length === 0 && <p className={styles.noData}>{t('noData')}</p>}
        {data.componentGroups.map(group => {
          const id = String(group._id);
          const isExpanded = expanded.has(id);
          return (
            <div key={id} className={`${styles.groupCard} ${!group.isAvailable ? styles.unavailCard : ''}`}>
              <div className={styles.groupHeader}>
                <span className={styles.groupName}>{group.name}</span>
                {group.isRequired && <span className={styles.badge}>{t('required')}</span>}
                <span className={styles.optsBadge}>{t('optionsCount', { n: group.options?.length ?? 0 })}</span>
                <UsageBadge dishes={group.usedInDishes} />
                <AvailToggle item={group} />
                <div className={styles.groupActions}>
                  <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => handleDelete(group)} title={t('delete')}><MdDelete /></button>
                  <button className={styles.iconBtn} onClick={() => toggleExpand(id)}>
                    {isExpanded ? <MdExpandLess /> : <MdExpandMore />}
                  </button>
                </div>
              </div>
              {isExpanded && (group.options || []).length > 0 && (
                <div className={styles.optionsList}>
                  {group.options.map(opt => (
                    <div key={String(opt._id)} className={styles.optionRow}>
                      <span>{opt.name}</span>
                      {opt.priceModifier !== 0 && (
                        <span className={styles.optPrice}>{opt.priceModifier > 0 ? '+' : ''}{opt.priceModifier}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function renderAddRow(extraField) {
    if (!addForm) {
      return (
        <button className={styles.addBtn} onClick={openAdd}>
          <MdAdd />
          {activeTab === 'ingredients' ? t('addIngredient') : t('addAddon')}
        </button>
      );
    }
    return (
      <div className={styles.addRow}>
        <input
          className={styles.inlineInput}
          placeholder={t('name')}
          value={addForm.name}
          onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
        />
        {extraField === 'isRemovable' && (
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={addForm.isRemovable} onChange={e => setAddForm(f => ({ ...f, isRemovable: e.target.checked }))} />
            {t('removable')}
          </label>
        )}
        {extraField === 'price' && (
          <input
            className={styles.inlineInput}
            style={{ width: 80 }}
            type="number"
            placeholder={t('price')}
            value={addForm.price}
            onChange={e => setAddForm(f => ({ ...f, price: e.target.value }))}
          />
        )}
        <button className={styles.iconBtn} onClick={saveAdd}><MdCheck /></button>
        <button className={styles.iconBtn} onClick={cancelAdd}><MdClose /></button>
      </div>
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
              onClick={() => { setActiveTab(tab); setEditingId(null); setAddForm(null); }}
            >
              {t(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`)}
            </button>
          ))}
        </div>
        <div className={styles.content}>
          {loading
            ? null
            : activeTab === 'ingredients'     ? renderIngredients()
            : activeTab === 'addons'          ? renderAddons()
            : renderComponentGroups()}
        </div>
      </div>
    </StaffShell>
  );
}
