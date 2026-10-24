import { formatMoney } from '../utils/formatMoney'

// Pichhle 7 din ke naam nikalta hai, aaj ko aakhir me rakhkar: ["Thu","Fri",...,"Wed"]
function lastSevenDayNames() {
  const names = []
  for (let back = 6; back >= 0; back -= 1) {
    const day = new Date()
    day.setDate(day.getDate() - back)
    names.push(day.toLocaleDateString('en-IN', { weekday: 'short' }))
  }
  return names
}

// Bina kisi chart library ke seedha CSS se bana bar chart.
// Har bar ki unchai = (us din ki kamai / sabse zyada kamai) x 100%.
// Props: amounts (7 numbers), previousTotal (pichhle hafte ka total, badhat nikalne ke liye).
export default function WeeklyRevenueChart({ amounts, previousTotal }) {
  const days = lastSevenDayNames()
  const max = Math.max(...amounts)
  const total = amounts.reduce((sum, a) => sum + a, 0)
  const change = Math.round(((total - previousTotal) / previousTotal) * 100)

  return (
    <div className="gl-chart__root">
      <div className="gl-chart__head">
        <p className="gl-chart__total">
          {formatMoney(total)} <span>last 7 days</span>
        </p>
        <span className={change >= 0 ? 'gl-trend gl-trend--up' : 'gl-trend gl-trend--down'}>
          {change >= 0 ? '+' : ''}
          {change}% vs previous week
        </span>
      </div>

      {/* role="img" + aria-label: screen reader ko poore graph ka ek hi saaransh milta hai */}
      <div className="gl-chart" role="img" aria-label={`Revenue for the last 7 days, total ${formatMoney(total)}. ${days.map((d, i) => `${d} ${formatMoney(amounts[i])}`).join(', ')}`}>
        {amounts.map((amount, index) => (
          <div key={index} className="gl-chart__col">
            <div className="gl-chart__track">
              {/* Hover karne par exact rakam dikhti hai */}
              <span className="gl-chart__tip">{formatMoney(amount)}</span>
              <div
                className={index === amounts.length - 1 ? 'gl-chart__bar gl-chart__bar--today' : 'gl-chart__bar'}
                style={{ height: `${(amount / max) * 100}%`, '--delay': `${index * 70}ms` }}
              />
            </div>
            <span className="gl-chart__day">{index === amounts.length - 1 ? 'Today' : days[index]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
