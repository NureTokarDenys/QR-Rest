import React, { useState } from 'react';
import { StaffLayoutProvider, useStaffLayout } from '../../../context/StaffLayoutContext';
import Sidebar from '../Sidebar';
import StaffHeader from '../StaffHeader';
import RightPanel from '../RightPanel';
import styles from './staffShell.module.css';

function Inner({ children, title, backTo, rightActions }) {
  const { panelOpen } = useStaffLayout();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <div className={styles.sidebarBackdrop} onClick={() => setSidebarOpen(false)} />
      )}
      <div className={`${styles.main} ${panelOpen ? styles.mainShifted : ''}`}>
        <StaffHeader
          title={title}
          backTo={backTo}
          rightActions={rightActions}
          onMenuToggle={() => setSidebarOpen(o => !o)}
        />
        <div className={styles.content}>
          {children}
        </div>
      </div>
      <RightPanel />
    </div>
  );
}

export default function StaffShell({ children, title, backTo, rightActions }) {
  return (
    <StaffLayoutProvider>
      <Inner title={title} backTo={backTo} rightActions={rightActions}> {children} </Inner>
    </StaffLayoutProvider>
  );
}