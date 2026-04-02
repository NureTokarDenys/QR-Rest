import { MdHourglassTop, MdLocalFireDepartment, MdCheck, MdCheckBox } from "react-icons/md";

export const STATUS_KEYS = ['waiting', 'cooking', 'ready', 'served'];

export const STATUS_STYLES = {
  waiting: { bg: '#e8f4ff', color: '#1d7afc', icon: <MdHourglassTop /> },
  cooking: { bg: '#fff3e0', color: '#f57c00', icon: <MdLocalFireDepartment /> }, 
  ready:   { bg: '#e8f5e9', color: '#2e7d32', icon: <MdCheck /> }, 
  served:  { bg: '#e8f5e9', color: '#2e7d32', icon: <MdCheckBox /> }, 
};