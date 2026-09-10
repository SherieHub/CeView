package com.ceview.module2.submodule21;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

import java.time.LocalDate;

/** Versioned route and carrier facts used by Module 2 market displays. */
@Data
@Entity
@Table(name = "tbl_market_route_reference")
public class MarketRouteReference {

    @Id
    @Column(name = "market", length = 60)
    private String market;

    @Column(name = "nearest_airport", nullable = false, length = 120)
    private String nearestAirport;

    @Column(name = "destination_airport", nullable = false, length = 120)
    private String destinationAirport;

    @Column(name = "direct_flight", nullable = false)
    private Boolean directFlight;

    @Column(name = "flight_hours", nullable = false, length = 64)
    private String flightHours;

    @Column(name = "distance_km", nullable = false)
    private Integer distanceKm;

    @Column(name = "weekly_frequency", nullable = false)
    private Integer weeklyFrequency;

    @Column(name = "avg_fare_min_php", nullable = false)
    private Integer avgFareMinPhp;

    @Column(name = "avg_fare_max_php", nullable = false)
    private Integer avgFareMaxPhp;

    /** JSON array containing carrier name, code, frequency, and direct fields. */
    @Column(name = "airlines_json", nullable = false, columnDefinition = "TEXT")
    private String airlinesJson;

    @Column(name = "source", nullable = false, length = 120)
    private String source;

    @Column(name = "valid_from", nullable = false)
    private LocalDate validFrom;
}
