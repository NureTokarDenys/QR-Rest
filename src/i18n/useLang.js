import { useTranslation } from 'react-i18next';

export function useLocalField() {
  const { i18n } = useTranslation();
  
  return (obj, field) => {
    const key = i18n.language === 'en' ? `${field}_en` : field;
    return obj?.[key] ?? obj?.[field];
  };
}