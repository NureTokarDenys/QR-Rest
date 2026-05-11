import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import InputField from '../../../components/InputField';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import { Dropdown } from '../../../components/Dropdown';
import {
  getStaff, createStaff, updateStaffRole,
  deactivateStaff, activateStaff, resetStaffPassword,
} from '../../../api/admin';
import styles from './staffManagement.module.css';
import { MdPeople, MdAdd } from 'react-icons/md';

const ROLES = ['cook', 'waiter', 'waiter_cook', 'admin'];

function Modal({ title, children, onClose }) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{title}</span>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>{children}</div>
      </div>
    </div>
  );
}

function PasswordDisplay({ title, text, password, onClose, t }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className={styles.pwdText}>{text}</p>
      <div className={styles.pwdBox}>{password}</div>
      <div className={styles.modalFooter}>
        <PrimaryButton label={t('close')} onClick={onClose} />
      </div>
    </Modal>
  );
}

export default function StaffManagement() {
  const { t } = useTranslation('staffManagement');

  const [staff,    setStaff]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showAdd,  setShowAdd]  = useState(false);
  const [pwdModal, setPwdModal] = useState(null); // { title, text, password }

  // Add staff form state
  const [addName,  setAddName]  = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addRole,  setAddRole]  = useState('waiter');
  const [addErr,   setAddErr]   = useState('');
  const [creating, setCreating] = useState(false);

  const roleOptions = ROLES.map(r => ({ value: r, label: t(`role_${r}`) }));

  const load = useCallback(() => {
    setLoading(true);
    getStaff()
      .then(res => setStaff(res?.data || []))
      .catch(() => setStaff([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    setAddErr('');
    if (!addName.trim() || !addEmail.trim()) { setAddErr('Name and email are required'); return; }
    setCreating(true);
    try {
      const created = await createStaff({ name: addName, email: addEmail, role: addRole });
      setShowAdd(false);
      setAddName(''); setAddEmail(''); setAddRole('waiter');
      load();
      setPwdModal({
        title:    t('tempPasswordTitle'),
        text:     t('tempPasswordText'),
        password: created.tempPassword,
      });
    } catch (err) {
      setAddErr(err?.response?.data?.error?.message || t('errorCreate'));
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleChange(userId, role) {
    try {
      await updateStaffRole(userId, role);
      setStaff(prev => prev.map(u => u._id === userId ? { ...u, role } : u));
    } catch (err) {
      console.error('Role change error:', err);
    }
  }

  async function handleToggleActive(user) {
    const confirmed = window.confirm(
      user.isActive ? t('confirmDeactivate') : t('confirmActivate')
    );
    if (!confirmed) return;
    try {
      if (user.isActive) {
        await deactivateStaff(user._id);
        setStaff(prev => prev.map(u => u._id === user._id ? { ...u, isActive: false } : u));
      } else {
        await activateStaff(user._id);
        setStaff(prev => prev.map(u => u._id === user._id ? { ...u, isActive: true } : u));
      }
    } catch (err) {
      console.error('Toggle active error:', err);
    }
  }

  async function handleResetPassword(user) {
    const confirmed = window.confirm(t('confirmResetPassword'));
    if (!confirmed) return;
    try {
      const res = await resetStaffPassword(user._id);
      setPwdModal({
        title:    t('resetPasswordTitle'),
        text:     t('resetPasswordText'),
        password: res.newPassword,
      });
    } catch (err) {
      console.error('Reset password error:', err);
    }
  }

  return (
    <StaffShell
      title={<><MdPeople /> {t('title')}</>}
      rightActions={
        <button className={styles.addBtn} onClick={() => setShowAdd(true)}>
          <MdAdd /> {t('addStaff')}
        </button>
      }
    >
      <div className={styles.page}>
        {loading ? (
          <div className={styles.empty}>…</div>
        ) : staff.length === 0 ? (
          <div className={styles.empty}>{t('noStaff')}</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>{t('name')}</th>
                  <th className={styles.th}>{t('email')}</th>
                  <th className={styles.th}>{t('role')}</th>
                  <th className={styles.th}>{t('status')}</th>
                  <th className={styles.th}>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(user => (
                  <tr key={user._id} className={`${styles.row} ${!user.isActive ? styles.rowInactive : ''}`}>
                    <td className={styles.td}>
                      <div className={styles.userCell}>
                        <div className={styles.avatar}>
                          {user.name ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?'}
                        </div>
                        <span className={styles.userName}>{user.name}</span>
                      </div>
                    </td>
                    <td className={styles.td}><span className={styles.email}>{user.email}</span></td>
                    <td className={styles.td}>
                      <div className={styles.roleDropdown}>
                        <Dropdown
                          options={roleOptions}
                          value={user.role}
                          onChange={val => handleRoleChange(user._id, val)}
                        />
                      </div>
                    </td>
                    <td className={styles.td}>
                      <span className={`${styles.statusBadge} ${user.isActive ? styles.statusActive : styles.statusInactive}`}>
                        {user.isActive ? t('active') : t('inactive')}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.actions}>
                        <button
                          className={`${styles.actionBtn} ${user.isActive ? styles.deactivateBtn : styles.activateBtn}`}
                          onClick={() => handleToggleActive(user)}
                        >
                          {user.isActive ? t('deactivate') : t('activate')}
                        </button>
                        <button
                          className={`${styles.actionBtn} ${styles.resetBtn}`}
                          onClick={() => handleResetPassword(user)}
                        >
                          {t('resetPassword')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add staff modal */}
      {showAdd && (
        <Modal title={t('addTitle')} onClose={() => { setShowAdd(false); setAddErr(''); }}>
          <div className={styles.addForm}>
            <InputField
              label={t('name')}
              placeholder={t('namePlaceholder')}
              value={addName}
              onChange={e => setAddName(e.target.value)}
            />
            <InputField
              label={t('email')}
              placeholder={t('emailPlaceholder')}
              value={addEmail}
              onChange={e => setAddEmail(e.target.value)}
            />
            <Dropdown
              label={t('role')}
              options={roleOptions}
              value={addRole}
              onChange={setAddRole}
            />
            {addErr && <p className={styles.addErr}>{addErr}</p>}
          </div>
          <div className={styles.modalFooter}>
            <SecondaryButton label={t('cancel') || 'Cancel'} onClick={() => { setShowAdd(false); setAddErr(''); }} />
            <PrimaryButton label={creating ? t('creating') : t('create')} onClick={handleCreate} disabled={creating} />
          </div>
        </Modal>
      )}

      {/* Temp password / reset password modal */}
      {pwdModal && (
        <PasswordDisplay
          title={pwdModal.title}
          text={pwdModal.text}
          password={pwdModal.password}
          onClose={() => setPwdModal(null)}
          t={t}
        />
      )}
    </StaffShell>
  );
}
