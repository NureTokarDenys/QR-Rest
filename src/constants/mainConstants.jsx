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

/**
 * PDF templates are now PRESETS: clicking one merges its fields into the
 * generator's settings, but every value is then user-editable. Each template
 * provides a typography + colour bundle. Anything missing falls back to the
 * generator's default settings.
 */
export const PDF_GENERATOR_TEMPLATES = [
  {
    id: 'classic',
    label_ua: 'Класичний',
    label_en: 'Classic',
    preview: 'linear-gradient(135deg, #1d7afc 60%, #60a5fa)',
    fontFamily: 'sans',
    fontSize: 'md',
    colorBg:        '#ffffff',
    colorHeader:    '#1d7afc',
    colorText:      '#111111',
    colorDesc:      '#555555',
    colorPrice:     '#1d7afc',
    colorSeparator: '#e5e5ea',
  },
  {
    id: 'dark',
    label_ua: 'Темний',
    label_en: 'Dark',
    preview: 'linear-gradient(135deg, #1a1a2e 60%, #16213e)',
    fontFamily: 'modern',
    fontSize: 'md',
    colorBg:        '#1a1a2e',
    colorHeader:    '#e2b96f',
    colorText:      '#f0f0f0',
    colorDesc:      '#9999bb',
    colorPrice:     '#e2b96f',
    colorSeparator: '#2d2d4e',
  },
  {
    id: 'minimal',
    label_ua: 'Мінімал',
    label_en: 'Minimal',
    preview: 'linear-gradient(135deg, #f9fafb 60%, #e5e7eb)',
    fontFamily: 'serif',
    fontSize: 'lg',
    colorBg:        '#f9fafb',
    colorHeader:    '#374151',
    colorText:      '#111827',
    colorDesc:      '#6b7280',
    colorPrice:     '#374151',
    colorSeparator: '#d1d5db',
  },
  {
    id: 'warm',
    label_ua: 'Теплий',
    label_en: 'Warm',
    preview: 'linear-gradient(135deg, #fff7ed 60%, #fed7aa)',
    fontFamily: 'serif',
    fontSize: 'md',
    colorBg:        '#fff7ed',
    colorHeader:    '#c2410c',
    colorText:      '#431407',
    colorDesc:      '#92400e',
    colorPrice:     '#c2410c',
    colorSeparator: '#fed7aa',
  },
  {
    id: 'bold',
    label_ua: 'Сміливий',
    label_en: 'Bold',
    preview: 'linear-gradient(135deg, #000000 60%, #404040)',
    fontFamily: 'condensed',
    fontSize: 'lg',
    colorBg:        '#0d0d0d',
    colorHeader:    '#fbbf24',
    colorText:      '#ffffff',
    colorDesc:      '#a1a1aa',
    colorPrice:     '#fbbf24',
    colorSeparator: '#3f3f46',
  },
];

/** Available font stacks for the PDF — system fonts only, no external loading. */
export const PDF_FONT_STACKS = {
  sans:      'system-ui, -apple-system, "Segoe UI", sans-serif',
  serif:     'Georgia, "Times New Roman", serif',
  modern:    '"Helvetica Neue", Arial, sans-serif',
  mono:      '"Courier New", monospace',
  condensed: '"Arial Narrow", "Roboto Condensed", sans-serif',
};

/** Font-size multipliers — applied to a base of 14px via CSS variable. */
export const PDF_FONT_SCALES = {
  xs: 0.78,
  sm: 0.9,
  md: 1,
  lg: 1.15,
  xl: 1.3,
};
