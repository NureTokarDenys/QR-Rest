import { MdHourglassTop, MdLocalFireDepartment, MdCheck, MdCheckBox } from "react-icons/md";

export const STATUS_KEYS = ['waiting', 'cooking', 'ready', 'served'];

export const STATUS_STYLES = {
  waiting: { bg: '#e8f4ff', color: '#1d7afc', icon: <MdHourglassTop /> },
  cooking: { bg: '#fff3e0', color: '#f57c00', icon: <MdLocalFireDepartment /> }, 
  ready:   { bg: '#e8f5e9', color: '#2e7d32', icon: <MdCheck /> }, 
  served:  { bg: '#e8f5e9', color: '#2e7d32', icon: <MdCheckBox /> }, 
};

export const ORDER_COLORS = [
  '#ef4444', // Червоний
  '#f97316', // Помаранчевий
  '#f59e0b', // Бурштиновий
  '#eab308', // Жовтий
  '#84cc16', // Салатовий
  '#22c55e', // Зелений
  '#10b981', // Смарагдовий
  '#14b8a6', // Бірюзовий
  '#06b6d4', // Блакитний
  '#0ea5e9', // Небесно-синій
  '#3b82f6', // Синій
  '#6366f1', // Індиго
  '#8b5cf6', // Фіолетовий
  '#a855f7', // Пурпуровий
  '#d946ef', // Фуксія
  '#ec4899', // Рожевий
  '#f43f5e', // Малиновий
  '#881337', // Бордовий
  '#1e3a8a', // Темно-синій
  '#14532d'  // Темно-зелений
];