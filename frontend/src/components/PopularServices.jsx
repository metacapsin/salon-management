import { formatMoney } from '../utils/formatMoney'

// Services ke photo wale cards. Props: services (list).
// alt="" kyunki photo sirf sajawat hai, asli jaankari neeche likhe text me hai.
export default function PopularServices({ services }) {
  return (
    <div className="gl-services">
      {services.map((service) => (
        <article key={service.id} className="gl-service">
          <img src={service.image} alt="" loading="lazy" />
          <div className="gl-service__shade" />
          <div className="gl-service__body">
            <h4>{service.name}</h4>
            <p>
              {service.bookings} bookings · {formatMoney(service.revenue)}
            </p>
          </div>
        </article>
      ))}
    </div>
  )
}
