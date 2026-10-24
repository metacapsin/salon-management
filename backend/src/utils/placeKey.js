// Jagah ke naam ki "pehchaan-kunji". Hindi naam angrezi me alag-alag likhe jaate hain
// (Bijainagar / Vijainagar / Vijaynagar, Bangalore / Bengaluru...). Kunji me ye farq mit jaate hain, isliye
// "Bijainagar" likhne wale salon aur "Vijainagar" bataane wali location ek hi jagah maani jaati hain.

// Naam badal chuke bade shehar: purana naam -> naya naam
const RENAMED = {
  bombay: 'mumbai',
  calcutta: 'kolkata',
  madras: 'chennai',
  bangalore: 'bengaluru',
  gurgaon: 'gurugram',
  baroda: 'vadodara',
  mysore: 'mysuru',
  poona: 'pune',
  cochin: 'kochi',
  trivandrum: 'thiruvananthapuram',
  allahabad: 'prayagraj',
  banaras: 'varanasi',
  benares: 'varanasi',
}

function placeKey(name) {
  let k = String(name ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // accent hatao
    .toLowerCase()
    .replace(/\b(municipal corporation|municipal council|nagar nigam|nagar palika|nagar parishad|tehsil|tahsil|taluka|taluk|district|city|town|village|municipality)\b/g, ' ') // "Vijaynagar Tehsil" = "Vijaynagar"
    .trim()
  k = RENAMED[k] ?? k
  k = k.replace(/[^a-z]/g, '') // sirf akshar
  return k
    .replace(/[vw]/g, 'b') // b/v/w ek hi
    .replace(/ph/g, 'f')
    .replace(/sh|z/g, 's')
    .replace(/(kh|gh|th|dh)/g, (m) => m[0]) // aspirate: 'dh' -> 'd'
    .replace(/ai|ay|ae|ei|ey/g, 'a')
    .replace(/ee|ii/g, 'i')
    .replace(/oo|uu/g, 'u')
    .replace(/y/g, 'i')
    .replace(/(.)\1+/g, '$1') // double akshar ek
}

module.exports = { placeKey }
