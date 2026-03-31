import { useNavigate } from "react-router-dom";
import styles from "./clientToast.module.css";

const ClientToast = ({ message, onClose }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    onClose();
    navigate("/cart");
  };

  return (
    <div className={styles.toast} onClick={handleClick}>
      <div className={styles.progress} />
      {message}
    </div>
  );
};

export default ClientToast;