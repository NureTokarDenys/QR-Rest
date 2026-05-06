import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { getRestaurants } from '../../../api/restaurants';
import SearchBar from '../../../components/SearchBar';
import styles from './restaurantPicker.module.css';
import { MdQrCodeScanner, MdStorefront, MdLocationOn } from 'react-icons/md';

// ─── Restaurant card ──────────────────────────────────────────────────────────

function RestaurantCard({ restaurant, onSelect }) {
  const initials = (restaurant.name || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <button className={styles.card} onClick={() => onSelect(restaurant)}>
      <div className={styles.cardLogo}>
        {restaurant.logoUrl
          ? <img src={restaurant.logoUrl} alt={restaurant.name} className={styles.cardLogoImg} />
          : <span className={styles.cardLogoInitials}>{initials}</span>
        }
      </div>
      <div className={styles.cardBody}>
        <p className={styles.cardName}>{restaurant.name}</p>
        {restaurant.cuisine && (
          <p className={styles.cardCuisine}>{restaurant.cuisine}</p>
        )}
        {restaurant.address && (
          <p className={styles.cardAddress}>
            <MdLocationOn className={styles.cardAddrIcon} />
            {restaurant.address}
          </p>
        )}
      </div>
      <MdStorefront className={styles.cardArrow} />
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RestaurantPicker() {
  const navigate = useNavigate();
  const { selectRestaurant } = useApp();

  const [query, setQuery]           = useState('');
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [apiAvailable, setApiAvailable] = useState(true);

  // Fetch restaurant list on mount.
  // If the backend hasn't implemented GET /restaurants yet the page falls back
  // to a QR-scan prompt — see the remark in src/api/restaurants.js.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getRestaurants()
      .then(data => {
        if (cancelled) return;
        setRestaurants(Array.isArray(data) ? data : []);
        setApiAvailable(true);
      })
      .catch(() => {
        if (cancelled) return;
        setApiAvailable(false);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Client-side filter on the name/address while the user types.
  // A live API search is triggered automatically when the user pauses — the
  // backend can extend GET /restaurants?q=<query> for server-side full-text.
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    if (!apiAvailable) return;
    if (!query.trim()) {
      // Reset to full list
      getRestaurants()
        .then(data => setRestaurants(Array.isArray(data) ? data : []))
        .catch(() => {});
      return;
    }
    setSearchLoading(true);
    const timer = setTimeout(() => {
      getRestaurants(query.trim())
        .then(data => setRestaurants(Array.isArray(data) ? data : []))
        .catch(() => {})
        .finally(() => setSearchLoading(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [query, apiAvailable]);

  function handleSelect(restaurant) {
    // publicId is the 8-char alphanumeric used to prefix all restaurant-scoped URLs
    const id = restaurant.publicId || restaurant._id || restaurant.id;
    selectRestaurant(id, restaurant.name);
    navigate('/menu');
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <span className={styles.logo}>
          <span className={styles.logoWait}>Wait</span>
          <span className={styles.logoLess}>less</span>
        </span>
      </header>

      <div className={styles.content}>
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>Choose a restaurant</h1>
          <p  className={styles.heroSub}>
            Select from the list below or scan the QR code at your table
          </p>
        </div>

        {/* Search bar */}
        <SearchBar
          placeholder="Search restaurants…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        {/* States */}
        {loading && (
          <p className={styles.stateMsg}>Loading restaurants…</p>
        )}

        {!loading && !apiAvailable && (
          /* API not yet implemented — guide the user to QR scan */
          <div className={styles.noApiBox}>
            <MdQrCodeScanner className={styles.noApiIcon} />
            <p className={styles.noApiTitle}>Restaurant listing not available</p>
            <p className={styles.noApiSub}>
              Scan the QR code at your table to open the menu directly.
            </p>
          </div>
        )}

        {!loading && apiAvailable && restaurants.length === 0 && (
          <p className={styles.stateMsg}>
            {query.trim() ? 'No restaurants match your search.' : 'No restaurants found.'}
          </p>
        )}

        {!loading && apiAvailable && restaurants.length > 0 && (
          <div className={styles.list}>
            {searchLoading && <p className={styles.searching}>Searching…</p>}
            {restaurants.map(r => (
              <RestaurantCard
                key={r.publicId || r._id || r.id}
                restaurant={r}
                onSelect={handleSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
