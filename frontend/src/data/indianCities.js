// India ke bade shehron ki list (city, state). City picker me type karne par yahi suggestions aate hain.
// Isme shehar na ho to bhi owner apna shehar khud likh sakta hai (freeSolo), aur salon judte hi wo city list me aa jaati hai.
const raw = {
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati', 'Nellore'],
  Assam: ['Guwahati', 'Dibrugarh', 'Silchar'],
  Bihar: ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur'],
  Chandigarh: ['Chandigarh'],
  Chhattisgarh: ['Raipur', 'Bhilai', 'Bilaspur'],
  Delhi: ['Delhi'],
  Goa: ['Panaji', 'Margao', 'Vasco da Gama'],
  Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar', 'Bhavnagar', 'Jamnagar'],
  Haryana: ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Karnal', 'Hisar', 'Rohtak'],
  'Himachal Pradesh': ['Shimla', 'Manali', 'Dharamshala'],
  'Jammu and Kashmir': ['Srinagar', 'Jammu'],
  Jharkhand: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro'],
  Karnataka: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi'],
  Kerala: ['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Kollam'],
  'Madhya Pradesh': ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain'],
  Maharashtra: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane', 'Aurangabad', 'Navi Mumbai', 'Kolhapur', 'Solapur'],
  Odisha: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Puri'],
  Punjab: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Mohali', 'Bathinda'],
  Rajasthan: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner', 'Alwar'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli'],
  Telangana: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Noida', 'Ghaziabad', 'Agra', 'Varanasi', 'Meerut', 'Prayagraj', 'Bareilly', 'Aligarh', 'Mathura', 'Greater Noida'],
  Uttarakhand: ['Dehradun', 'Haridwar', 'Rishikesh', 'Haldwani'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Siliguri', 'Asansol'],
}

export const INDIAN_CITIES = Object.entries(raw)
  .flatMap(([state, cities]) => cities.map((city) => ({ city, state })))
  .sort((a, b) => a.city.localeCompare(b.city))

// City ka state (jaise "Pune" -> "Maharashtra"), na mile to khaali
export const stateOfCity = (city) =>
  INDIAN_CITIES.find((c) => c.city.toLowerCase() === city.trim().toLowerCase())?.state ?? ''
