// Immagini stadio realistiche (Unsplash CDN, hotlink-friendly) per le card schedina.
const STADIUM_IMAGES = [
  'https://images.unsplash.com/photo-1549333580-4cb2c5c8e421', // Mercedes-Benz Stadium, Atlanta
  'https://images.unsplash.com/photo-1748150572481-13ce492e1b2b', // stadio al tramonto
  'https://images.unsplash.com/photo-1522778526097-ce0a22ceb253', // stadio gremito
  'https://images.unsplash.com/photo-1577223625816-7546f13df25d', // stadio illuminato
]

export function stadiumImage(schedinaId: number, w = 1200): string {
  const base = STADIUM_IMAGES[(schedinaId - 1) % STADIUM_IMAGES.length]
  return `${base}?w=${w}&q=70&auto=format&fit=crop`
}
