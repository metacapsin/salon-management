import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useCustomer } from '../../customer/CustomerAuthContext'
import { getPosition, locationErrorMessage, nearMeNotice, nearestCity } from '../../utils/geo'
import { getLocations, reversePlace, searchSalons } from '../../api/publicApi'
import QueryState from '../../components/QueryState'
import ExploreFilters from './ExploreFilters'
import { AudienceChips, CategoryChips } from './DiscoveryChips'
import LocationPicker from './LocationPicker'
import NoSalons from './NoSalons'
import ResultsState from './ResultsState'
import { priceRange } from './filterOptions'
import SalonCard from './SalonCard'
import SalonDialog from './SalonDialog'
import LoginDialog from './LoginDialog'
import '../../styles/explore.css'

// Landing page ke andar ka hissa "Find a salon near you": city/area chuno, salons dekho (Zomato jaisa). Salon ki list bina login ke dikhti hai;
// login tab maangte hain jab customer kisi salon par click kare (taaki owner ko pata chale kaun dekh raha hai).
// Saare chunav URL me rehte hain (?city=Delhi&area=Rohini&mode=home), isliye link share ya refresh karne par bhi wahi dikhta hai.
export default function ExploreSection() {
  const { status, customer, logout } = useCustomer()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  // Filter badalne par URL ka ?city=.. badalta hai. #find-salon saath rakhna zaroori hai, warna landing page ye section hata deta hai.
  const setParams = (next) => navigate({ pathname: '/', search: `?${new URLSearchParams(next)}`, hash: '#find-salon' }, { replace: true })
  const sectionRef = useRef(null)

  // Section khulte hi (button dabane par) is hisse tak scroll karo. Filter badalne par scroll nahi hota.
  useEffect(() => {
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const locations = useQuery({ queryKey: ['public', 'locations'], queryFn: getLocations, staleTime: 5 * 60_000 })
  const cities = locations.data?.cities ?? []

  // Shehar apne-aap location se set hota hai: URL me shehar na ho to pehle browser se location maangte hain
  // (auto: 'pending' -> 'running' -> 'done'). Location na mile to jis shehar me sabse zyada salons hain wo dikhate hain.
  const [auto, setAuto] = useState(() => (params.get('city') ? 'done' : 'pending'))
  const startedAuto = useRef(false) // dev me effect do baar chalta hai, location sirf ek baar maangni hai
  const [locating, setLocating] = useState(false)
  const [locNotice, setLocNotice] = useState('')
  const [pickedOrigin, setPickedOrigin] = useState(null) // suggestion se chuni jagah ke coordinates (URL me nahi rakhte)
  const [locError, setLocError] = useState('')
  const city = params.get('city') || (auto === 'done' ? cities[0]?.city || '' : '')
  const area = params.get('area') || ''
  const mode = params.get('mode') || ''
  const audience = params.get('audience') || ''
  const category = params.get('category') || ''
  const minRating = params.get('minRating') || ''
  const price = params.get('price') || ''
  const lat = params.get('lat') || ''
  const lng = params.get('lng') || ''
  const nearMe = Boolean(lat && lng)
  const sort = params.get('sort') === 'nearest' && !nearMe ? 'rating' : params.get('sort') || 'rating'
  const urlQ = params.get('q') || ''

  // Search box: har akshar par request na jaye, isliye 300ms ruk kar URL badalte hain.
  const [qInput, setQInput] = useState(urlQ)
  useEffect(() => {
    if (qInput === urlQ) return undefined
    const timer = setTimeout(() => update({ q: qInput }), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput])

  function update(changes) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (!next.get('city') && city) next.set('city', city)
    setParams(next)
  }

  // Location se shehar chunna: "Near me" button aur page khulte hi dono yahi use karte hain
  async function locate() {
    setLocError('')
    setLocNotice('')
    setLocating(true)
    try {
      const me = await getPosition()
      // Customer asli me kahan hai (shehar/kasba/gaon)? Wahi shehar set hota hai, chahe wahan salon ho ya na ho.
      const place = await reversePlace(me.lat, me.lng).catch(() => null)
      if (place?.name) {
        update({ city: place.name, area: '', lat: me.lat.toFixed(5), lng: me.lng.toFixed(5), sort: 'nearest' })
        setLocNotice(`Showing salons near you in ${[place.name, place.state].filter(Boolean).join(', ')}.`)
      } else {
        // Naam na mil paye (geocoder band) to sabse paas ke shehar jahan salon hain
        const nearest = nearestCity(cities, me)
        update({ city: nearest?.city ?? city, area: '', lat: me.lat.toFixed(5), lng: me.lng.toFixed(5), sort: 'nearest' })
        setLocNotice(nearMeNotice(nearest))
      }
      setPickedOrigin(null)
    } catch (error) {
      setLocError(locationErrorMessage(error))
    } finally {
      setLocating(false)
    }
  }

  useEffect(() => {
    if (auto !== 'pending' || !locations.data || startedAuto.current) return
    startedAuto.current = true
    if (cities.length === 0) {
      setAuto('done')
      return
    }
    setAuto('running')
    locate().finally(() => setAuto('done'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, locations.data])

  // Search box se chuni hui jagah: shehar badlo; uske coordinates sirf "paas ke salon" dikhane ke liye yaad rakho
  function placePicked({ city: picked, lat: pLat, lng: pLng }) {
    setLocNotice('')
    setLocError('')
    setPickedOrigin(pLat !== undefined && pLng !== undefined ? { lat: pLat, lng: pLng } : null)
    update({ city: picked, area: '', lat: '', lng: '', sort: sort === 'nearest' ? 'rating' : sort })
  }

  const origin = nearMe ? { lat: Number(lat), lng: Number(lng) } : pickedOrigin

  const filters = { city, area, mode, audience, category, minRating, ...priceRange(price), q: urlQ, sort, lat, lng, pageSize: 24 }
  const results = useQuery({
    queryKey: ['public', 'salons', filters],
    queryFn: () => searchSalons(filters),
    enabled: Boolean(city),
    placeholderData: keepPreviousData,
  })

  const [openSalon, setOpenSalon] = useState(null)
  const [loginFor, setLoginFor] = useState(null) // login ke baad jo salon kholni hai
  // Login hai to salon seedha khulti hai (aur owner ko khabar jaati hai); nahi to pehle isi page par login ka popup
  const [loginThen, setLoginThen] = useState('view') // login ke baad: 'view' = popup kholo, 'book' = seedha booking page
  const openSalonOrLogin = (salon) => {
    if (status === 'authenticated') return setOpenSalon(salon)
    setLoginThen('view')
    setLoginFor(salon)
  }
  const bookSalonOrLogin = (salon) => {
    if (status === 'authenticated') return navigate(`/book/${salon.id}`)
    setLoginThen('book')
    setLoginFor(salon)
  }
  const total = results.data?.meta?.total ?? 0
  const where = area ? `${area}, ${city}` : city

  return (
    <section id="find-salon" ref={sectionRef} className="ex ex-section" aria-label="Find a salon near you">
      <main className="lp-container ex-main">
        <div className="ex-hero">
          <div className="ex-hero__text">
            <p className="ex-hero__eyebrow">Glamora</p>
            <h2>Find Your Perfect Salon</h2>
            <p>Discover the best beauty and grooming services near you.</p>
            {status === 'authenticated' && (
              <p className="ex-header__user">
                {customer.name} · +91 {customer.phone}{' '}
                <button type="button" className="ex-header__logout" onClick={logout}>
                  Log out
                </button>
              </p>
            )}
          </div>
          <div className="ex-hero__image" aria-hidden="true" />
        </div>

        <QueryState query={locations}>
          <LocationPicker cities={cities} city={city} area={area} nearMe={nearMe} locating={locating} notice={locNotice} error={locError} onPlacePicked={placePicked} onNearMe={locate} onClearNearMe={() => { setLocNotice(''); update({ lat: '', lng: '', sort: 'rating' }) }} onChange={(changes) => { setLocNotice(''); update(changes) }} />
          <CategoryChips category={category} onChange={update} />
          <AudienceChips audience={audience} onChange={update} />
          <ExploreFilters
            mode={mode}
            sort={sort}
            rating={minRating}
            price={price}
            q={qInput}
            nearMe={nearMe}
            onChange={(changes) => {
              if ('q' in changes) setQInput(changes.q)
              else update(changes)
            }}
          />

          <h2 className="ex-count">
            {!city ? 'Finding salons near you…' : results.data ? `${total} ${total === 1 ? 'salon' : 'salons'} in ${where}` : `Salons in ${where}`}
          </h2>

          <ResultsState
            query={results}
            isEmpty={total === 0}
            empty={
              <NoSalons
                city={city}
                where={where}
                cities={cities}
                origin={origin}
                onOpen={openSalonOrLogin}
                onBook={bookSalonOrLogin}
                onClearFilters={() => setParams({ city })}
                onViewCity={(next) => {
                  setLocNotice('')
                  update({ city: next, area: '', lat: '', lng: '', sort: 'rating' })
                }}
              />
            }
          >
            <div className={results.isPlaceholderData ? 'ex-grid ex-grid--stale' : 'ex-grid'}>
              {results.data?.salons.map((salon) => (
                <SalonCard key={salon.id} salon={salon} onOpen={openSalonOrLogin} onBook={bookSalonOrLogin} />
              ))}
            </div>
          </ResultsState>
        </QueryState>
      </main>
      {loginFor && (
        <LoginDialog
          salon={loginFor}
          onClose={() => setLoginFor(null)}
          onDone={() => {
            if (loginThen === 'book') navigate(`/book/${loginFor.id}`)
            else setOpenSalon(loginFor)
            setLoginFor(null)
          }}
        />
      )}
      {openSalon && <SalonDialog salon={openSalon} onClose={() => setOpenSalon(null)} />}
    </section>
  )
}
