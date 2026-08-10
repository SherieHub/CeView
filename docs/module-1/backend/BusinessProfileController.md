# `BusinessProfileController`

**Package:** `com.ceview.module1.businessinput` · **File:**
[`backend/spring-boot/src/main/java/com/ceview/module1/businessinput/BusinessProfileController.java`](../../../backend/spring-boot/src/main/java/com/ceview/module1/businessinput/BusinessProfileController.java)

## Responsibility

Load and persist the operator's `BusinessProfile` entity. The one write path shared by
[Onboarding step 5's finish action](../screens/onboarding-wizard.md) and
[Settings → Business profile's Save](../screens/settings-business-profile.md).

## Endpoints

| Method | Path | Called by |
|---|---|---|
| `GET` | `/api/v1/business-profile` | App mount (`apiClient.loadProfile`) |
| `PUT` | `/api/v1/business-profile` | Onboarding finish, Settings Save (`apiClient.saveProfile`) |
| `POST` | `/api/v1/business-profile/keywords` | (not used by any current screen doc — legacy SEO keyword panel from the pre-overhaul `BusinessProfile.tsx`; retained for now, revisit once the overhaul frontend plan reaches parity) |

## Collaborators

- `BusinessProfileRepository` — `JpaRepository<BusinessProfile, UUID>`, `findFirstByUserId(UUID)`.
- `AIInferenceGatewayService.generateKeywords` — backs the keywords endpoint.

## Persistence

`tbl_business_profile` (see [`schema-delta.md`](schema-delta.md) for columns the UI/UX overhaul
requires that don't exist in this table today).

## Failure modes

Standard `BusinessProfileDto` validation on `PUT`; no profile found on `GET` returns an empty/default
DTO rather than 404 (frontend treats `uniquenessScore == null` as "needs onboarding").
