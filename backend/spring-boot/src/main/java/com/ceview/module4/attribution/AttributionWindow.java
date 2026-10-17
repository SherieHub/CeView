package com.ceview.module4.attribution;

import java.time.OffsetDateTime;

/**
 * The campaign window a code and its link both cover.
 *
 * <p>Shared by both mint services so the two can never disagree about which window a booking
 * belongs to — a code and a link minted off the same alert with different end dates would produce
 * two different sets of "in-window" bookings for what the operator sees as one campaign.
 *
 * <p>14 days is a fixed constant, deliberately not configurable: per-operator window lengths would
 * need a settings surface to build and explain, and would make the Performance screen's lift
 * comparison incomparable between operators.
 */
public final class AttributionWindow {

  public static final int WINDOW_DAYS = 14;

  private AttributionWindow() {}

  public static OffsetDateTime endFor(OffsetDateTime windowOpenDate) {
    return windowOpenDate.plusDays(WINDOW_DAYS);
  }

  public static boolean covers(OffsetDateTime start, OffsetDateTime end, OffsetDateTime at) {
    return !at.isBefore(start) && !at.isAfter(end);
  }
}
