import Icon from './Icon'
import { formatMoney } from '../utils/formatMoney'

// Ek chhota card: icon, bada number, label, note aur ek "trend" chip (badhat/ghatat).
// Props (parent se milne wali cheezein): icon, label, value, isMoney, note, trend, delay.
// delay = animation kitni der baad shuru ho (taaki cards ek-ek karke aayein).
export default function StatCard({ icon, label, value, isMoney, note, trend, delay = 0 }) {
  return (
    <article className="gl-card gl-card--hover gl-stat gl-fade-up" style={{ '--delay': `${delay}ms` }}>
      <div className="gl-stat__top">
        <span className="gl-stat__icon">
          <Icon name={icon} size={22} />
        </span>
        {trend && (
          <span className={trend.up ? 'gl-trend gl-trend--up' : 'gl-trend gl-trend--down'}>
            <Icon name="trending" size={14} />
            {trend.text}
          </span>
        )}
      </div>
      <p className="gl-stat__label">{label}</p>
      <p className="gl-stat__value">{isMoney ? formatMoney(value) : value}</p>
      <p className="gl-stat__note">{note}</p>
    </article>
  )
}
