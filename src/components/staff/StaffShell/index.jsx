import React from 'react';
import { StaffLayoutProvider, useStaffLayout } from '../../../context/StaffLayoutContext';
import Sidebar from '../Sidebar';
import StaffHeader from '../StaffHeader';
import RightPanel from '../RightPanel';
import styles from './staffShell.module.css';

function Inner({ children, title, backTo, rightActions }) {
  const { panelOpen } = useStaffLayout();

  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={`${styles.main} ${panelOpen ? styles.mainShifted : ''}`}>
        <StaffHeader title={title} backTo={backTo} rightActions={rightActions}/>
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