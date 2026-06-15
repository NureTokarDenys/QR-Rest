import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import { Skel } from '../../../components/staff/Skeleton';
import InputField from '../../../components/InputField';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import { Dropdown } from '../../../components/Dropdown';
import UpgradeModal from '../../../components/UpgradeModal';
import ConfirmDialog from '../../../components/ConfirmDialog';
import {
  createStaff, updateStaffRole,
  deactivateStaff, activateStaff, resetStaffPassword,
} from '../../../api/admin';
import { usePlan } from '../../../hooks/usePlan';
import { useAuth } from '../../../context/AuthContext';
import { useStaffData } from '../../../context/StaffDataContext';
import styles from './staffManagement.module.css';
import { MdPeople, MdAdd, MdLock, MdShield } from 'react-icons/md';

const FREE_STAFF_LIMIT = 3;

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
  const { isFree } = usePlan();
  const { user: authUser } = useAuth();
  const isRootAdmin = authUser?.role === 'root_admin';
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Staff list from shared cache (lazy-loaded on first visit, kept fresh via WS).
  const { staff: cachedStaff, refreshStaff, ensureStaff } = useStaffData();
  useEffect(() => { ensureStaff(); }, [ensureStaff]);
  const staff = Array.isArray(cachedStaff) ? cachedStaff : [];
  const loading = cachedStaff === null;
  const [showAdd,   setShowAdd]   = useState(false);
  const [pwdModal,  setPwdModal]  = useState(null); // { title, text, password } — only for new account temp password
  const [confirm,   setConfirm]   = useState(null); // { type: 'deactivate'|'activate'|'reset', user }
  const [infoModal, setInfoModal] = useState(null); // { title, body }

  // Add staff form state
  const [addName,  setAddName]  = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addRole,  setAddRole]  = useState('waiter');
  const [addErr,   setAddErr]   = useState('');
  const [creating, setCreating] = useState(false);

  const roleOptions = ROLES
    .filter(r => isRootAdmin || r !== 'admin')
    .map(r => ({ value: r, label: t(`role_${r}`) }));

  // load() now just refreshes the shared cache (was: direct API call + local state)
  const load = refreshStaff;

  async function handleCreate() {
    setAddErr('');
    if (!addName.trim() || !addEmail.trim()) { setAddErr(t('nameEmailRequired')); return; }
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
      // Cache will auto-refresh via STAFF_UPDATED WS event; call refresh anyway
      // so this admin's screen reflects the change instantly.
      refreshStaff();
    } catch (err) {
      console.error('Role change error:', err);
    }
  }

  function handleToggleActive(user) {
    setConfirm({ type: user.isActive ? 'deactivate' : 'activate', user });
  }

  function handleResetPassword(user) {
    setConfirm({ type: 'reset', user });
  }

  async function handleConfirmed() {
    if (!confirm) return;
    const { type, user } = confirm;
    setConfirm(null);
    try {
      if (type === 'deactivate') {
        await deactivateStaff(user._id);
        refreshStaff();
      } else if (type === 'activate') {
        await activateStaff(user._id);
        refreshStaff();
      } else if (type === 'reset') {
        await resetStaffPassword(user._id);
        setInfoModal({
          title: t('resetPasswordSentTitle'),
          body:  t('resetPasswordSentText', { email: user.email }),
        });
      }
    } catch (err) {
      console.error(`${type} error:`, err);
    }
  }

  return (
    <>
    <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} ns="components" reason="upgrade_limit_staff" />

    <ConfirmDialog
      open={Boolean(confirm)}
      title={confirm ? t(`confirm${confirm.type.charAt(0).toUpperCase() + confirm.type.slice(1)}Title`) : ''}
      message={confirm ? t(`confirm${confirm.type.charAt(0).toUpperCase() + confirm.type.slice(1)}Message`, { name: confirm.user?.name, email: confirm.user?.email }) : ''}
      confirmLabel={t('confirm')}
      cancelLabel={t('cancel')}
      onConfirm={handleConfirmed}
      onCancel={() => setConfirm(null)}
    />
    <StaffShell
      title={<><MdPeople /> {t('title')}</>}
      rightActions={
        <button
          className={styles.addBtn}
          onClick={() => {
            if (isFree && staff.length >= FREE_STAFF_LIMIT) {
              setUpgradeOpen(true);
            } else {
              setShowAdd(true);
            }
          }}
        >
          {isFree && staff.length >= FREE_STAFF_LIMIT
            ? <><MdLock /> {t('addStaff')}</>
            : <><MdAdd /> {t('addStaff')}</>
          }
        </button>
      }
    >
      <div className={styles.page}>
        {loading ? (
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
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className={styles.row}>
                    <td className={styles.td}>
                      <div className={styles.userCell}>
                        <Skel w={34} h={34} r="50%" />
                        <Skel w={120 + ((i * 17) % 50)} h={14} />
                      </div>
                    </td>
                    <td className={styles.td}>
                      <Skel w={150 + ((i * 13) % 40)} h={13} />
                    </td>
                    <td className={styles.td}>
                      <div className={styles.roleDropdown}>
                        <Skel w={160} h={32} r={8} />
                      </div>
                    </td>
                    <td className={styles.td}>
                      <Skel w={76} h={22} r={20} />
                    </td>
                    <td className={styles.td}>
                      <div className={styles.actions}>
                        <Skel w={104} h={26} r={6} />
                        <Skel w={120} h={26} r={6} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                      {user.role === 'root_admin' ? (
                        <div className={styles.rootAdminRole}>
                          <MdShield className={styles.rootAdminIcon} />
                          <span>{t('role_root_admin')}</span>
                        </div>
                      ) : (!isRootAdmin && user.role === 'admin') || user._id === authUser?._id ? (
                        <div className={styles.rootAdminRole}>
                          <span>{t(`role_${user.role}`)}</span>
                        </div>
                      ) : (
                        <div className={styles.roleDropdown}>
                          <Dropdown
                            options={roleOptions}
                            value={user.role}
                            onChange={val => handleRoleChange(user._id, val)}
                          />
                        </div>
                      )}
                    </td>
                    <td className={styles.td}>
                      <span className={`${styles.statusBadge} ${user.isActive ? styles.statusActive : styles.statusInactive}`}>
                        {user.isActive ? t('active') : t('inactive')}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.actions}>
                        {user.role !== 'root_admin' && (
                          <button
                            className={`${styles.actionBtn} ${user.isActive ? styles.deactivateBtn : styles.activateBtn}`}
                            onClick={() => handleToggleActive(user)}
                          >
                            {user.isActive ? t('deactivate') : t('activate')}
                          </button>
                        )}
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
            <SecondaryButton label={t('cancel')} onClick={() => { setShowAdd(false); setAddErr(''); }} />
            <PrimaryButton label={creating ? t('creating') : t('create')} onClick={handleCreate} disabled={creating} />
          </div>
        </Modal>
      )}

      {/* Temp password modal — shown only when creating a new account */}
      {pwdModal && (
        <PasswordDisplay
          title={pwdModal.title}
          text={pwdModal.text}
          password={pwdModal.password}
          onClose={() => setPwdModal(null)}
          t={t}
        />
      )}

      {/* Info modal — shown after password reset email is sent */}
      {infoModal && (
        <Modal title={infoModal.title} onClose={() => setInfoModal(null)}>
          <p className={styles.pwdText}>{infoModal.body}</p>
          <div className={styles.modalFooter}>
            <PrimaryButton label={t('close')} onClick={() => setInfoModal(null)} />
          </div>
        </Modal>
      )}
    </StaffShell>
    </>
  );
}
