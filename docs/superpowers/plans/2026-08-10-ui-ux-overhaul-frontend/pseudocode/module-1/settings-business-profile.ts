// ---- components/settings/BusinessProfileSettings.tsx ----
imports: useState, useProfile, apiClient, BusinessProfile type

function BusinessProfileSettings():
  { profile, setProfile } ← useProfile()
  state: form ← profile (pre-filled)

  toggleCategory(name):
    selected ← form.categories includes name
    if selected AND form.categories.length === 1 → no-op (same >=1-selected rule as onboarding Step 5)
    else → toggle name in form.categories

  handleSave():
    // KNOWN GAP: Save does not recompute the uniqueness score after an edit, though the
    // Save-button copy implies it does — flag in code review, don't silently resolve
    apiClient.saveProfile(form)  // not yet a real apiClient method
    setProfile(form)  // re-syncs sidebar identity block without a page reload

  render: identity header (avatar, name, industry, score chips — read from `profile`, not `form`) +
          name/slogan inputs + categories toggle grid (calls toggleCategory) +
          core services read-only list + description/uvp textareas (no word-count gate here) +
          website input + Save button (calls handleSave)
