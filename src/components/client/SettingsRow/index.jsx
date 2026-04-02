import { useState, useRef, useEffect, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './settingsRow.module.css';

import { MdLightMode } from "react-icons/md";
import { MdDarkMode } from "react-icons/md";

export default function SettingsRow({ icon, label, value, onClick, danger = false }) {
  return (
    <button
      className={`${styles.row} ${danger ? styles.danger : ''}`}
      onClick={onClick}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.label}>{label}</span>
      {value && <span className={styles.value}>{value}</span>}
      {!danger && <span className={styles.chevron}>›</span>}
    </button>
  );
}

export function SettingsRowDropdown({ icon, label, options, value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [listPos, setListPos] = useState({ top: 0, right: 0 });
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const id = useId();

  const selected = options.find((o) => o.value === value) ?? null;

  const calcPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setListPos({
      top: rect.bottom + window.scrollY + 4,
      right: window.innerWidth - rect.right,
    });
  }, []);

  const open = () => {
    calcPosition();
    setIsOpen(true);
    const idx = options.findIndex((o) => o.value === value);
    setFocusedIndex(idx >= 0 ? idx : 0);
  };

  const close = () => {
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  const select = (option) => {
    onChange(option.value);
    close();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (
        !triggerRef.current?.contains(e.target) &&
        !listRef.current?.contains(e.target)
      ) {
        close();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('scroll', calcPosition, true);
    window.addEventListener('resize', calcPosition);
    return () => {
      window.removeEventListener('scroll', calcPosition, true);
      window.removeEventListener('resize', calcPosition);
    };
  }, [isOpen, calcPosition]);

  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!isOpen) open();
        else if (focusedIndex >= 0) select(options[focusedIndex]);
        break;
      case 'Escape':
        close();
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) { open(); break; }
        setFocusedIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Tab':
        close();
        break;
    }
  };

  return (
    <div className={`${styles.row} ${styles.rowWithDropdown}`}>
      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.label}>{label}</span>

      <button
        ref={triggerRef}
        id={id}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={`${id}-list`}
        className={styles.dropdownTrigger}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={handleKeyDown}
      >
        {selected?.icon && <span className={styles.optionIcon}>{selected.icon}</span>}
        <span className={styles.dropdownTriggerText}>
          {selected?.label ?? 'Оберіть...'}
        </span>
        <ChevronIcon
          className={`${styles.dropdownChevron} ${isOpen ? styles.dropdownChevronOpen : ''}`}
        />
      </button>

      {isOpen &&
        createPortal(
          <ul
            ref={listRef}
            id={`${id}-list`}
            role="listbox"
            className={styles.dropdownList}
            style={{ top: listPos.top, right: listPos.right }}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isFocused = index === focusedIndex;

              return (
                <li
                  key={String(option.value)}
                  role="option"
                  aria-selected={isSelected}
                  className={[
                    styles.dropdownOption,
                    isSelected ? styles.dropdownOptionSelected : '',
                    isFocused ? styles.dropdownOptionFocused : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => select(option)}
                  onMouseEnter={() => setFocusedIndex(index)}
                >
                  {option.icon && <span className={styles.optionIcon}>{option.icon}</span>}
                  <span>{option.label}</span>
                  {isSelected && <CheckIcon className={styles.dropdownCheck} />}
                </li>
              );
            })}
          </ul>,
          document.body
        )}
    </div>
  );
}

export function ThemeSettingsRow({ icon, theme, onThemeChange }) {
  const THEME_OPTIONS = [
    { value: 'light',  label: 'Світла',   icon: <MdLightMode /> },
    { value: 'dark',   label: 'Темна',    icon: <MdDarkMode /> },
  ];

  return (
    <SettingsRowDropdown
      icon={icon}
      label="Тема"
      options={THEME_OPTIONS}
      value={theme}
      onChange={onThemeChange}
    />
  );
}

function ChevronIcon({ className }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ className }) {
  return (
    <svg className={className} width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}