// NOTE ON docs/module-2/backend/category-scoped-ranking.md's "Option 2": that doc assumes
// DemandAlert already carries one category per row (from a 21-job category×market grid). In the
// actual codebase, DemandAlert has no category column — persistDemandAlert() in ForecastingService
// generates alerts per (profile, market) only, unconditioned on category. The per-category signal
// that *does* exist is the keyword-trend NotificationDto CategoryRankNotificationService already
// builds once per profile category. M2-B2 embeds categoryMarketRanks there instead — same outcome
// (Dashboard gets category-scoped ranks without a second round-trip), no new DB column needed.
// Whoever next touches category-scoped-ranking.md should update its "Option 2" section to match.

// ---- backend/spring-boot/src/main/java/com/ceview/module2/submodule22/NotificationService.java (modify) ----
getNotificationsForProfile(profileId):
  profileCategories ← profileRepo.findById(profileId).map(categoriesList).orElse(List.of())
  keywordNotifications ← categoryRankService.buildForCategories(profileId, profileCategories)   // profileId now passed through
  // ...rest unchanged (demand-alert merge, etc.)

// ---- backend/spring-boot/src/main/java/com/ceview/module2/submodule22/CategoryRankNotificationService.java (modify) ----
// New constructor dependency: this class today injects only `AIInferenceGatewayService ai` — add a
// `ForecastingService forecastingService` field/constructor param (no cycle: ForecastingService
// doesn't depend back on this class) so buildForCategories() can call the M2-B1 overload below.
imports: ForecastingService

buildForCategories(profileId: UUID, categories: List<String>) -> List<NotificationDto>:
  for category in categories:
    raw ← ai.rankMarketsForCategory(category)
    if raw is empty → continue (unchanged skip behavior)
    categoryRanks ← forecastingService.loadMarketsFromDb(profileId, category).markets()   // M2-B1's overload
    result.add(toNotificationDto(category, raw, today, categoryRanks))
  return result

toNotificationDto(category, raw, today, categoryRanks: List<MarketDto>):
  // ...unchanged topMarketKey/topKeyword/topInterests/keywordData/insights mapping...
  details ← new DetailsDto(
    0, 0.0, topInterests, List.of(), insights, keywordData,
    /* contentStrategy */ null,
    /* categoryMarketRanks */ categoryRanks)   // new field

// ---- backend/spring-boot/src/main/java/com/ceview/module2/dto/NotificationDtos.java (modify DetailsDto) ----
// Field names below match the real record (NotificationDtos.java) exactly — arrivalGrowth, segments,
// and strategicInsights, not the growthRate/tags/insights shorthand used above for readability.
record DetailsDto(
  int projectedArrivals, double arrivalGrowth,
  List<TopInterestDto> topInterests, List<String> segments,
  StrategicInsightsDto strategicInsights, List<KeywordTrendDto> keywordData,
  ContentStrategyDto contentStrategy,
  List<MarketDto> categoryMarketRanks   // new field
)

// Required companion touch point: DetailsDto's canonical record constructor now takes 8 args, not 7 —
// every existing call site must add the new trailing argument or the build won't compile. The one
// other call site is NotificationService.buildDetails() (demand-surge notifications), which becomes:
// ---- backend/spring-boot/src/main/java/com/ceview/module2/submodule22/NotificationService.java (modify buildDetails()) ----
buildDetails(ms, fr):
  // ...unchanged projectedArrivals/growthRate/interests/insights construction...
  return new DetailsDto(
    projectedArrivals, growthRate, interests,
    List.of("Leisure", "Adventure", "Cultural"), insights,
    List.of(),   // keywordData — populated by Module 3 content service
    null,        // contentStrategy — nullable per DTO spec
    null)        // categoryMarketRanks — demand-surge notifications aren't category-scoped; only
                 // CategoryRankNotificationService.toNotificationDto() populates this field
