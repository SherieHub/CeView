// ---- backend/spring-boot/src/main/java/com/ceview/module2/ForecastingController.java (modify markets()) ----
@GetMapping("/markets")
markets(@RequestParam(required = false) UUID profileId, @RequestParam(required = false) String category):
  resolvedProfileId ← currentBusinessProfile.resolveOrValidate(profileId)
  result ← (category != null && !category.isBlank())
    ? forecastingService.loadMarketsFromDb(resolvedProfileId, category)
    : forecastingService.loadMarketsFromDb(resolvedProfileId)   // existing path, unchanged
  return 200 result
  // same try/catch → 503 {"code": "MOD22_MARKETS_FAILED", ...} wrapper as today

// ---- backend/spring-boot/src/main/java/com/ceview/module2/submodule22/ForecastingService.java (new overload) ----
loadMarketsFromDb(UUID profileId, String category) -> MarketsResponse:
  base ← loadMarketsFromDb(profileId)   // existing method, fully unchanged
  if base.markets().isEmpty() → return base
  ranking ← ai.rankMarketsForCategory(category)   // AIInferenceGatewayService, already used by
                                                   // CategoryRankNotificationService.buildForCategories()
  reordered ← CategoryMarketRanker.reorder(base.markets(), ranking)
  return new MarketsResponse(reordered)

// ---- backend/spring-boot/src/main/java/com/ceview/module2/submodule22/CategoryMarketRanker.java (new) ----
class CategoryMarketRanker:
  static reorder(markets: List<MarketDto>, ranking: Map<String, Object>) -> List<MarketDto>:
    rankedRaw ← ranking.getOrDefault("ranked_markets", List.of())   // [{market: "korea", total_volume: ...}, ...]
    orderedMarketIds ← rankedRaw.map(entry -> entry.get("market"))  // e.g. ["korea", "japan", "usa"], already ordered
    sorted ← markets.sortedBy(m -> {
      idx ← orderedMarketIds.indexOf(m.id())   // MarketDto's market-key field is `id` (e.g. "korea"), not `market`
      return idx == -1 ? Integer.MAX_VALUE : idx   // markets missing from the category ranking sort last
    })
    // MarketDto is a 21-component record with no auto-generated wither — withRank(int) must be
    // hand-written (re-listing every field, only `rank` changed) as part of this card's work.
    return sorted.mapIndexed((i, m) -> m.withRank(i + 1))
