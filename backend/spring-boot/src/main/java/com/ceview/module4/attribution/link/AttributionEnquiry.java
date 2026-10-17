package com.ceview.module4.attribution.link;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Data;

/**
 * A booking enquiry submitted on CeView's hosted page (tier 2), tied to the click that brought the
 * traveller there.
 *
 * <p>Its own table rather than columns on {@link AttributionClick} because this is the only place
 * real traveller PII lands, and it needs a retention policy the click table does not. Clicks can be
 * kept indefinitely for rollups; names and contact details should not be.
 *
 * <p>One enquiry per click: a traveller who double-submits the form should not produce two
 * bookings.
 */
@Data
@Entity
@Table(
    name = "tbl_attribution_enquiry",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uq_attr_enquiry_click",
            columnNames = {"click_id"}))
public class AttributionEnquiry {

  @Id
  @Column(name = "enquiry_id")
  private UUID enquiryId;

  @Column(name = "click_id", nullable = false)
  private UUID clickId;

  @Column(name = "business_profile_id", nullable = false)
  private UUID businessProfileId;

  @Column(name = "contact_name", nullable = false, length = 200)
  private String contactName;

  /** Whatever the traveller gave us to reach them — email, phone, handle. */
  @Column(name = "contact_value", nullable = false, length = 200)
  private String contactValue;

  @Column(name = "party_size")
  private Integer partySize;

  @Column(name = "requested_start")
  private LocalDate requestedStart;

  @Column(name = "requested_end")
  private LocalDate requestedEnd;

  @Column(name = "message", columnDefinition = "TEXT")
  private String message;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt;

  @PrePersist
  void onCreate() {
    if (enquiryId == null) enquiryId = UUID.randomUUID();
    if (createdAt == null) createdAt = OffsetDateTime.now();
  }
}
