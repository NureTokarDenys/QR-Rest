import { useState, useRef, useEffect, useId } from "react";
import styles from "./Dropdown.module.css";

export function Dropdown({
  options = [],
  value,
  onChange,
  placeholder = "Оберіть...",
  label,
  disabled = false,
  error,
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);
  const listRef = useRef(null);
  const id = useId();

  const selected = options.find((o) => o.value === value) ?? null;

  useEffect(() => {
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[focusedIndex];
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex]);

  const open = () => {
    if (disabled) return;
    setIsOpen(true);
    const currentIndex = selected
      ? options.findIndex((o) => o.value === selected.value)
      : -1;
    setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
  };

  const close = () => {
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  const select = (option) => {
    if (option.disabled) return;
    onChange(option.value);
    close();
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    switch (e.key) {
      case "Enter":
      case " ": {
        e.preventDefault();
        if (!isOpen) {
          open();
        } else if (focusedIndex >= 0) {
          select(options[focusedIndex]);
        }
        break;
      }
      case "Escape": {
        close();
        break;
      }
      case "ArrowDown": {
        e.preventDefault();
        if (!isOpen) { open(); break; }
        let next = focusedIndex + 1;
        while (next < options.length && options[next].disabled) next++;
        if (next < options.length) setFocusedIndex(next);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        if (!isOpen) break;
        let prev = focusedIndex - 1;
        while (prev >= 0 && options[prev].disabled) prev--;
        if (prev >= 0) setFocusedIndex(prev);
        break;
      }
      case "Home": {
        e.preventDefault();
        const firstEnabled = options.findIndex((o) => !o.disabled);
        if (firstEnabled >= 0) setFocusedIndex(firstEnabled);
        break;
      }
      case "End": {
        e.preventDefault();
        let last = options.length - 1;
        while (last >= 0 && options[last].disabled) last--;
        if (last >= 0) setFocusedIndex(last);
        break;
      }
      case "Tab": {
        close();
        break;
      }
    }
  };

  return (
    <div className={`${styles.wrapper} ${className}`}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      )}

      <div
        ref={containerRef}
        className={[
          styles.container,
          isOpen ? styles.open : "",
          disabled ? styles.disabled : "",
          error ? styles.hasError : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onKeyDown={handleKeyDown}
      >
        <div
          id={id}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={`${id}-list`}
          aria-activedescendant={
            focusedIndex >= 0 ? `${id}-option-${focusedIndex}` : undefined
          }
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          className={styles.trigger}
          onClick={() => (isOpen ? close() : open())}
        >
          <span className={selected ? styles.selectedText : styles.placeholder}>
            {selected ? (
              <>
                {selected.icon && (
                  <span className={styles.icon}>{selected.icon}</span>
                )}
                {selected.label}
              </>
            ) : (
              placeholder
            )}
          </span>
          <ChevronIcon className={`${styles.chevron} ${isOpen ? styles.chevronUp : ""}`} />
        </div>

        {isOpen && (
          <ul
            ref={listRef}
            id={`${id}-list`}
            role="listbox"
            aria-label={label}
            className={styles.list}
          >
            {options.length === 0 ? (
              <li className={styles.empty}>Немає варіантів</li>
            ) : (
              options.map((option, index) => {
                const isSelected = option.value === value;
                const isFocused = index === focusedIndex;

                return (
                  <li
                    key={String(option.value)}
                    id={`${id}-option-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled}
                    className={[
                      styles.option,
                      isSelected ? styles.optionSelected : "",
                      isFocused ? styles.optionFocused : "",
                      option.disabled ? styles.optionDisabled : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => select(option)}
                    onMouseEnter={() =>
                      !option.disabled && setFocusedIndex(index)
                    }
                  >
                    {option.icon && (
                      <span className={styles.icon}>{option.icon}</span>
                    )}
                    <span>{option.label}</span>
                    {isSelected && <CheckIcon className={styles.check} />}
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

function ChevronIcon({ className }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon({ className }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.5 7L5.5 10L11.5 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}