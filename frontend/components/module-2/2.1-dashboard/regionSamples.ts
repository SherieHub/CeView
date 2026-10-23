/**
 * All 17 Philippine regions in rank order with their preview scores. Design
 * preview only: the API does not return regional rankings yet.
 * "Metro Manila" is the National Capital Region (NCR).
 */
export const SAMPLE_REGIONS = [
  { name: 'CALABARZON', score: 78 },
  { name: 'Metro Manila', score: 74 },
  { name: 'Central Luzon', score: 68 },
  { name: 'Western Visayas', score: 62 },
  { name: 'Davao Region', score: 60 },
  { name: 'Central Visayas', score: 57 },
  { name: 'Northern Mindanao', score: 55 },
  { name: 'Ilocos Region', score: 53 },
  { name: 'Bicol Region', score: 51 },
  { name: 'MIMAROPA', score: 49 },
  { name: 'Eastern Visayas', score: 47 },
  { name: 'Cordillera (CAR)', score: 45 },
  { name: 'SOCCSKSARGEN', score: 43 },
  { name: 'Zamboanga Peninsula', score: 41 },
  { name: 'Cagayan Valley', score: 39 },
  { name: 'Caraga', score: 37 },
  { name: 'BARMM', score: 35 },
] as const;
