package com.ceview.module3;

import static org.assertj.core.api.Assertions.assertThat;

import com.ceview.module3.dto.ContentDtos;
import java.lang.reflect.RecordComponent;
import java.util.Arrays;
import org.junit.jupiter.api.Test;

/** Three platforms, not four. The DTO is the contract the frontend narrows against. */
class NoNaverPlatformTest {

  @Test
  void captionsCarryNoNaverComponent() {
    RecordComponent[] components = ContentDtos.CaptionsDto.class.getRecordComponents();

    assertThat(Arrays.stream(components).map(RecordComponent::getName)).doesNotContain("naver");
  }

  @Test
  void theThreeRemainingPlatformsSurvive() {
    RecordComponent[] components = ContentDtos.CaptionsDto.class.getRecordComponents();

    assertThat(Arrays.stream(components).map(RecordComponent::getName))
        .contains("instagram", "tiktok", "facebook");
  }
}
