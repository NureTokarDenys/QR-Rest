import styles from "./clientToast.module.css";

// onClose: dismisses the toast (called after onClick, or when onClick is omitted)
// onClick: optional click handler (e.g. navigate to /cart). Receives no args.
const ClientToast = ({ message, onClose, onClick }) => {
  const handleClick = () => {
    if (onClick) onClick();
    onClose?.();
  };
  return (
    <div className={styles.toast} onClick={handleClick}>
      <div className={styles.progress} />
      {message}
    </div>
  );
};

export default ClientToast;