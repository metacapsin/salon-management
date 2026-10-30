// Admin ke har page ka upar ka hissa: bada title, ek line ka description, aur daayein taraf actions (jaise "Create salon").
// Header (upar ki patti) me title nahi hota, isliye page me sirf yahi ek h1 rehta he.
export default function PageHeader({ title, subtitle, actions, back }) {
  return (
    <header className="ad-head">
      <div className="ad-head__text">
        {back}
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="ad-head__actions">{actions}</div> : null}
    </header>
  )
}
