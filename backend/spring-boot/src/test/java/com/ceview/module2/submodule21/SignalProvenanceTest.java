package com.ceview.module2.submodule21;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;

/** V22's columns must round-trip through the entity. */
class SignalProvenanceTest {

  @Test
  void carriesSourceAndFetchTimestamp() {
    OffsetDateTime fetchedAt = OffsetDateTime.parse("2026-08-24T03:00:00Z");

    MarketSignalRecord record = new MarketSignalRecord();
    record.setSource("pytrends");
    record.setSourceFetchedAt(fetchedAt);

    assertThat(record.getSource()).isEqualTo("pytrends");
    assertThat(record.getSourceFetchedAt()).isEqualTo(fetchedAt);
  }
}
