import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import SearchBar from '../../../components/SearchBar';
import {
  getExtras,
  createIngredient, updateIngredient, deleteIngredient, setIngredientAvailability,
  createAddon,      updateAddon,      deleteAddon,      setAddonAvailability,
  updateComponentGroup, deleteComponentGroup, setComponentGroupAvailability,
  removeExtraRelation,
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
  const [tabSearch, setTabSearch]   = useState({ ingredients: '', addons: '', componentGroups: '' });
  const [confirmDialog, setConfirmDialog] = useState(null);

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
    if (activeTab === 'componentGroups') {
      setEditForm({
        name: item.name || '',
        isRequired: item.isRequired ?? false,
        isAvailable: item.isAvailable ?? true,
        options: (item.options || []).map((opt) => ({
          _id: opt._id,
          name: opt.name || '',
          priceModifier: opt.priceModifier ?? 0,
          isDefault: opt.isDefault ?? false,
        })),
      });
    } else {
      setEditForm({ name: item.name, isRemovable: item.isRemovable ?? true, price: item.price ?? 0 });
    }
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
      } else if (activeTab === 'componentGroups') {
        const existing = data.componentGroups.find(g => String(g._id) === id);
        const wasAvailable = existing?.isAvailable ?? true;
        const updatedGroup = await updateComponentGroup(id, {
          name: editForm.name,
          isRequired: !!editForm.isRequired,
          options: (editForm.options || []).map(o => ({
            name: o.name,
            priceModifier: Number(o.priceModifier) || 0,
            isDefault: !!o.isDefault,
          })),
        });
        if (wasAvailable !== !!editForm.isAvailable) {
          await setComponentGroupAvailability(id, !!editForm.isAvailable);
        }
        setData(prev => ({
          ...prev,
          componentGroups: prev.componentGroups.map(g => String(g._id) === id
            ? {
                ...g,
                ...(updatedGroup || {}),
                name: editForm.name,
                isRequired: !!editForm.isRequired,
                isAvailable: !!editForm.isAvailable,
                options: (updatedGroup?.options || editForm.options || []),
              }
            : g),
        }));
      }
      setEditingId(null);
    } catch (err) { console.error('save edit error:', err); }
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
      } else if (activeTab === 'componentGroups') {
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
            else if (activeTab === 'componentGroups') await deleteComponentGroup(id, { force: true });
            setData(prev => ({
              ...prev,
              ingredients: activeTab === 'ingredients' ? prev.ingredients.filter(i => String(i._id) !== id) : prev.ingredients,
              addons: activeTab === 'addons' ? prev.addons.filter(a => String(a._id) !== id) : prev.addons,
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

  async function handleDetachRelation(itemId, extraType, extraId) {
    try {
      await removeExtraRelation(extraType, extraId, itemId);
      await load();
    } catch (err) {
      console.error('remove relation error:', err);
    }
  }

  function renderUsageList(item, extraType) {
    const dishes = item.usedInDishes || [];
    if (!dishes.length) return <span className={styles.unusedBadge}>{t('unused')}</span>;
    const top = dishes.slice(0, 3);
    return (
      <div className={styles.usageList}>
        {top.map((d) => (
          <span key={String(d._id)} className={styles.dishBadge}>
            <span className={styles.dishName}>{d.name}</span>
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
                  <td>{renderUsageList(item, 'ingredients')}</td>
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
                        <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => {
                          setConfirmDialog({
                            type: 'delete',
                            item,
                            onConfirm: async () => { await handleDelete(item); },
                          });
                        }} title={t('delete')}><MdDelete /></button>
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
                  <td>{renderUsageList(item, 'addons')}</td>
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
                        <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => {
                          setConfirmDialog({
                            type: 'delete',
                            item,
                            onConfirm: async () => { await handleDelete(item); },
                          });
                        }} title={t('delete')}><MdDelete /></button>
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
        {filteredComponentGroups.length === 0 && <p className={styles.noData}>{t('noData')}</p>}
        {filteredComponentGroups.map(group => {
          const id = String(group._id);
          const isExpanded = expanded.has(id);
          return (
            <div key={id} className={`${styles.groupCard} ${!group.isAvailable ? styles.unavailCard : ''}`}>
              <div className={styles.groupHeader}>
                {editingId === id ? (
                  <input
                    className={styles.inlineInput}
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                  />
                ) : (
                  <span className={styles.groupName}>{group.name}</span>
                )}
                <span className={styles.optsBadge}>
                  {t('optionsCount', {
                    count: (editingId === id ? (editForm.options?.length || 0) : (group.options?.length || 0)),
                    position: t('position', { count: (editingId === id ? (editForm.options?.length || 0) : (group.options?.length || 0)) }),
                  })}
                </span>
                {editingId === id ? (
                  <>
                    <label className={styles.checkLabel}>
                      <input
                        type="checkbox"
                        checked={!!editForm.isRequired}
                        onChange={(e) => setEditForm(f => ({ ...f, isRequired: e.target.checked }))}
                      />
                      {t('switchRequired')}
                    </label>
                    <label className={styles.checkLabel}>
                      <input
                        type="checkbox"
                        checked={!!editForm.isAvailable}
                        onChange={(e) => setEditForm(f => ({ ...f, isAvailable: e.target.checked }))}
                      />
                      {t('switchAvailable')}
                    </label>
                  </>
                ) : (
                  <>
                    {group.isRequired && <span className={styles.badge}>{t('required')}</span>}
                    <AvailToggle item={group} />
                  </>
                )}
                <div className={styles.groupActions}>
                  {editingId === id ? (
                    <>
                      <button className={styles.iconBtn} onClick={() => saveEdit(group)} title={t('saveComponentGroup')}><MdCheck /></button>
                      <button className={styles.iconBtn} onClick={cancelEdit} title={t('cancel')}><MdClose /></button>
                    </>
                  ) : (
                    <>
                      <button className={styles.iconBtn} onClick={() => startEdit(group)} title={t('editComponentGroup')}><MdEdit /></button>
                      <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => {
                        setConfirmDialog({
                          type: 'delete',
                          item: group,
                          onConfirm: async () => { await handleDelete(group); },
                        });
                      }} title={t('delete')}><MdDelete /></button>
                    </>
                  )}
                  <button className={styles.iconBtn} onClick={() => toggleExpand(id)}>
                    {isExpanded ? <MdExpandLess /> : <MdExpandMore />}
                  </button>
                </div>
              </div>
              {isExpanded && (
                <div className={styles.optionsList}>
                  {(editingId === id ? (editForm.options || []) : (group.options || [])).map((opt, idx) => (
                    <div key={String(opt._id || idx)} className={styles.optionRow}>
                      {editingId === id ? (
                        <>
                          <input
                            className={styles.inlineInput}
                            value={opt.name}
                            placeholder={t('optionName')}
                            onChange={(e) => setEditForm(f => ({
                              ...f,
                              options: (f.options || []).map((o, i) => i === idx ? { ...o, name: e.target.value } : o),
                            }))}
                          />
                          <input
                            className={styles.inlineInput}
                            style={{ width: 96 }}
                            type="number"
                            value={opt.priceModifier}
                            placeholder={t('priceModifier')}
                            onChange={(e) => setEditForm(f => ({
                              ...f,
                              options: (f.options || []).map((o, i) => i === idx ? { ...o, priceModifier: Number(e.target.value) || 0 } : o),
                            }))}
                          />
                          <button
                            className={`${styles.iconBtn} ${styles.danger}`}
                            onClick={() => setEditForm(f => ({
                              ...f,
                              options: (f.options || []).filter((_, i) => i !== idx),
                            }))}
                          >
                            <MdDelete />
                          </button>
                        </>
                      ) : (
                        <>
                          <span>{opt.name}</span>
                          {opt.priceModifier !== 0 && (
                            <span className={styles.optPrice}>{opt.priceModifier > 0 ? '+' : ''}{opt.priceModifier}</span>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                  {editingId === id && (
                    <button
                      className={styles.addBtn}
                      onClick={() => setEditForm(f => ({
                        ...f,
                        options: [...(f.options || []), { _id: `new-${Date.now()}`, name: '', priceModifier: 0, isDefault: false }],
                      }))}
                    >
                      <MdAdd /> {t('addOption')}
                    </button>
                  )}
                  <div className={styles.usageInline}>{renderUsageList(group, 'componentGroups')}</div>
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

  const searchValue = tabSearch[activeTab] || '';
  const norm = searchValue.trim().toLowerCase();
  const filteredIngredients = data.ingredients.filter((item) => !norm || String(item.name || '').toLowerCase().includes(norm));
  const filteredAddons = data.addons.filter((item) => !norm || String(item.name || '').toLowerCase().includes(norm));
  const filteredComponentGroups = data.componentGroups.filter((item) => {
    if (!norm) return true;
    if (String(item.name || '').toLowerCase().includes(norm)) return true;
    return (item.options || []).some((opt) => String(opt.name || '').toLowerCase().includes(norm));
  });

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
          <SearchBar
            placeholder={t('searchPlaceholder')}
            value={searchValue}
            onChange={(e) => setTabSearch(prev => ({ ...prev, [activeTab]: e.target.value }))}
          />
          {loading
            ? null
            : activeTab === 'ingredients'     ? renderIngredients()
            : activeTab === 'addons'          ? renderAddons()
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
              {confirmDialog.type === 'delete'
                ? t('confirmDeleteItemSub', { name: confirmDialog.item?.name || '' })
                : t('confirmDeleteSub', { name: confirmDialog.item?.name || '', count: confirmDialog.count || 0 })}
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
