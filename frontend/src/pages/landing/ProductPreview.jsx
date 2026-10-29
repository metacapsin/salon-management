import Icon from '../../components/Icon'
import Reveal from './Reveal'

// Ek "app window" ka chhota namuna, seedha CSS se bana (koi screenshot nahi). Dikhata hai ki andar ka dashboard kaisa dikhega.
const TILES = [
  { icon: 'calendar', label: 'Appointments', value: '12' },
  { icon: 'users', label: 'Customers', value: '1,248' },
  { icon: 'rupee', label: 'Revenue', value: '₹18,450' },
  { icon: 'user', label: 'Staff free', value: '6 of 8' },
]
const BARS = [48, 36, 62, 44, 78, 100, 70]
const ROWS = [
  { time: '11:30', name: 'Priya Sharma', service: 'Hair spa', tone: 'brown' },
  { time: '12:15', name: 'Anjali Verma', service: 'Party makeup', tone: 'green' },
  { time: '01:00', name: 'Neha Gupta', service: 'Gold facial', tone: 'gold' },
]

export default function ProductPreview() {
  return (
    <section className="lp-preview" aria-labelledby="lp-preview-title">
      <div className="lp-container">
        <Reveal>
          <div className="lp-section-head lp-section-head--center">
            <p className="lp-eyebrow lp-eyebrow--dark">Your whole day, one screen</p>
            <h2 id="lp-preview-title">See what is happening in your salon at a glance</h2>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="lp-window" role="img" aria-label="Preview of the Galora dashboard with appointments, customers, revenue and staff availability">
            <div className="lp-window__bar" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="lp-window__body" aria-hidden="true">
              <div className="lp-window__side">
                <b>G</b>
                {['dashboard', 'calendar', 'users', 'scissors', 'card'].map((name) => (
                  <i key={name}>
                    <Icon name={name} size={16} />
                  </i>
                ))}
              </div>
              <div className="lp-window__main">
                <div className="lp-window__tiles">
                  {TILES.map((tile) => (
                    <div key={tile.label} className="lp-tile">
                      <Icon name={tile.icon} size={16} />
                      <small>{tile.label}</small>
                      <strong>{tile.value}</strong>
                    </div>
                  ))}
                </div>
                <div className="lp-window__panels">
                  <div className="lp-panel">
                    <small>Upcoming</small>
                    {ROWS.map((row) => (
                      <div key={row.time} className="lp-row">
                        <span>{row.time}</span>
                        <div>
                          <strong>{row.name}</strong>
                          <small>{row.service}</small>
                        </div>
                        <i className={`lp-dot lp-dot--${row.tone}`} />
                      </div>
                    ))}
                  </div>
                  <div className="lp-panel">
                    <small>This week</small>
                    <div className="lp-bars">
                      {BARS.map((height, index) => (
                        <i key={index} style={{ height: `${height}%` }} className={index === BARS.length - 1 ? 'is-gold' : ''} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="lp-caption">Sample preview with demo data.</p>
        </Reveal>
      </div>
    </section>
  )
}
