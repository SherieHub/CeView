# Seed / Demo Operator Credentials

> **Seed/demo credentials only — never use these accounts or passwords in production.**
> These 9 MSME operator accounts are inserted by `V2__module1_profile_multi_category.sql`
> (and mirrored in `db/h2/V2__module1_profile_multi_category.sql`) purely for local
> development, QA, and testing of Module 1 business-profile flows.

| Operator | Business | Email | Password | Category |
|---|---|---|---|---|
| Ramon Dela Cruz Jr. | Moalboal FreeDive Cebu | ramon.delacruz@ceview.local | `MoalboalDive2024!` | Coastal & Island |
| Ferdinand "Ferdie" Bacus | Oslob Whale Shark Adventures | ferdie.bacus@ceview.local | `OslobWhaleTour88!` | Adventure & Nature |
| Marites Abellana | Bantayan Blue Waters Island Hopping | marites.abellana@ceview.local | `KawasanTrek2024!` | Coastal & Island |
| Teresita Osmeña-Ybañez | Sugbo Heritage Walks | teresita.osmena@ceview.local | `CebuHeritage1521!` | Cultural & Heritage |
| Ariel Cabahug | Sinulog Fiesta Dance & Cultural Show | ariel.cabahug@ceview.local | `SinulogFiesta77!` | Theme Parks / Entertainment |
| Nena Villaflor | Nena's Talisay Lechon House | nena.villaflor@ceview.local | `LechonCebu2024!` | Culinary & Gastronomy |
| Christian Mendiola | Mactan Sunset Beachfront Resort | christian.mendiola@ceview.local | `MactanSunset99!` | Accommodation & Staycation |
| Krizia Fernandez | IT Park Nightlife & City Tour Co. | krizia.fernandez@ceview.local | `ITParkStay2024!` | Urban & City |
| Boyet Lim | Carbon Market Street Food Crawl | boyet.lim@ceview.local | `BantayanBreeze24!` | Culinary & Gastronomy |

## Notes

- Passwords are stored as real BCrypt hashes (`BCryptPasswordEncoder`, default
  strength 10, matching `SecurityConfig.passwordEncoder()`), generated and
  verified with a throwaway JUnit test before being committed into the
  migration SQL.
- `operator_id` and `business_profile_id` UUIDs are fixed/deterministic
  literals documented in the header comment of
  `V2__module1_profile_multi_category.sql` — later Module 2/3/4 seed tasks
  should reference those IDs directly rather than querying for them.
