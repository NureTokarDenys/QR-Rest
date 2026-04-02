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

export const PDF_GENERATOR_TEMPLATES = [
  {
    id: 'classic',
    label_ua: 'Класичний',
    label_en: 'Classic',
    color: '#1d7afc',
    preview: 'linear-gradient(135deg, #1d7afc 60%, #60a5fa)',
    docBg: '#ffffff',
    headerColor: '#1d7afc',
    sectionColor: '#1d7afc',
    sectionBorder: '#e5e5ea',
    titleColor: '#111111',
    nameColor: '#111111',
    priceColor: '#1d7afc',
    descColor: '#555555',
    rowBorder: '#e5e5ea',
    imgRadius: '8px',
    fontFamily: 'inherit',
  },
  {
    id: 'dark',
    label_ua: 'Темний',
    label_en: 'Dark',
    color: '#1a1a2e',
    preview: 'linear-gradient(135deg, #1a1a2e 60%, #16213e)',
    docBg: '#1a1a2e',
    headerColor: '#e2b96f',
    sectionColor: '#e2b96f',
    sectionBorder: '#2d2d4e',
    titleColor: '#f0f0f0',
    nameColor: '#f0f0f0',
    priceColor: '#e2b96f',
    descColor: '#9999bb',
    rowBorder: '#2d2d4e',
    imgRadius: '6px',
    fontFamily: 'inherit',
  },
  {
    id: 'minimal',
    label_ua: 'Мінімал',
    label_en: 'Minimal',
    color: '#374151',
    preview: 'linear-gradient(135deg, #f9fafb 60%, #e5e7eb)',
    docBg: '#f9fafb',
    headerColor: '#374151',
    sectionColor: '#374151',
    sectionBorder: '#d1d5db',
    titleColor: '#111827',
    nameColor: '#111827',
    priceColor: '#374151',
    descColor: '#6b7280',
    rowBorder: '#e5e7eb',
    imgRadius: '4px',
    fontFamily: 'Georgia, serif',
  },
  {
    id: 'warm',
    label_ua: 'Теплий',
    label_en: 'Warm',
    color: '#c2410c',
    preview: 'linear-gradient(135deg, #fff7ed 60%, #fed7aa)',
    docBg: '#fff7ed',
    headerColor: '#c2410c',
    sectionColor: '#c2410c',
    sectionBorder: '#fed7aa',
    titleColor: '#431407',
    nameColor: '#431407',
    priceColor: '#c2410c',
    descColor: '#92400e',
    rowBorder: '#fed7aa',
    imgRadius: '50%',
    fontFamily: 'inherit',
  },
];
