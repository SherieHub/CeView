package com.ceview.module4;

import com.ceview.module4.dto.AnalyticsDtos.ManualIngestRequest;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/**
 * JPA entity that persists every operator-submitted campaign data ingestion.
 *
 * <p>Module 4 — SDD §4.1 (UC-4.1 raw data ingestion / FR4.26 persistence).
 *
 * <p>Lifecycle:
 * <ol>
 *   <li>{@code CampaignRecord.from(in)} — create from a {@link ManualIngestRequest}</li>
 *   <li>Saved to DB immediately after ingestion (before FastAPI call).</li>
 *   <li>{@link #enrichWithKpis} — called after Spring Boot computes KPIs.</li>
 *   <li>{@link #enrichWithPes}  — called after FastAPI {@code /internal/pes-compute/analyze}
 *       responds (or after the FR4.26 rule-based fallback runs).</li>
 * </ol>
 */
@Entity
@Table(name = "tbl_campaign_records")
public class CampaignRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(name = "campaign_id", updatable = false, nullable = false)
    private UUID id;

    // ── Raw operator inputs ───────────────────────────────────────────────────

    @Column(name = "impressions", nullable = false)
    private long impressions;

    @Column(name = "clicks", nullable = false)
    private long clicks;

    @Column(name = "ad_spend", nullable = false)
    private double adSpend;

    @Column(name = "revenue", nullable = false)
    private double revenue;

    @Column(name = "conversions", nullable = false)
    private long conversions;

    @Column(name = "bookings", nullable = false)
    private long bookings;

    @Column(name = "new_customers", nullable = false)
    private long newCustomers;

    // ── Derived KPIs (enriched after MetricsCalculationService.compute()) ────

    @Column(name = "ctr")
    private Double ctr;

    @Column(name = "cpc")
    private Double cpc;

    @Column(name = "conv_rate")
    private Double convRate;

    @Column(name = "roas")
    private Double roas;

    @Column(name = "cac")
    private Double cac;

    // ── PES result (enriched after FastAPI pes-compute/analyze, or FR4.26 fallback) ──

    @Column(name = "pes_score")
    private Double pesScore;

    @Column(name = "pes_label", length = 50)
    private String pesLabel;

    // ── Analysis window metadata ──────────────────────────────────────────────

    @Column(name = "analysis_weeks")
    private Integer analysisWeeks;

    @Column(name = "period_start", length = 20)
    private String periodStart;

    @Column(name = "period_end", length = 20)
    private String periodEnd;

    // ── Audit timestamps ──────────────────────────────────────────────────────

    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt;

    // ── Factory ───────────────────────────────────────────────────────────────

    /**
     * Build a {@link CampaignRecord} from a raw ingestion request.
     * Null-safe: any null field is coerced to zero.
     */
    public static CampaignRecord from(ManualIngestRequest in) {
        var r = new CampaignRecord();
        r.impressions  = in.impressions()  != null ? in.impressions()  : 0;
        r.clicks       = in.clicks()       != null ? in.clicks()       : 0;
        r.adSpend      = in.adSpend()      != null ? in.adSpend()      : 0.0;
        r.revenue      = in.revenue()      != null ? in.revenue()      : 0.0;
        r.conversions  = in.conversions()  != null ? in.conversions()  : 0;
        r.bookings     = in.bookings()     != null ? in.bookings()     : 0;
        r.newCustomers = in.newCustomers() != null ? in.newCustomers() : 0;
        r.periodStart  = in.periodStart();
        r.periodEnd    = in.periodEnd();
        return r;
    }

    // ── Enrichment helpers ────────────────────────────────────────────────────

    /** Populate computed KPI fields after MetricsCalculationService returns. */
    public void enrichWithKpis(double ctr, double cpc, double convRate, double roas, double cac) {
        this.ctr       = ctr;
        this.cpc       = cpc;
        this.convRate  = convRate;
        this.roas      = roas;
        this.cac       = cac;
        this.updatedAt = Instant.now();
    }

    /** Populate PES fields after FastAPI responds (or FR4.26 fallback runs). */
    public void enrichWithPes(double pesScore, String pesLabel) {
        this.pesScore  = pesScore;
        this.pesLabel  = pesLabel;
        this.updatedAt = Instant.now();
    }

    // ── Accessors ─────────────────────────────────────────────────────────────

    public UUID    getId()           { return id;           }
    public long    getImpressions()  { return impressions;  }
    public long    getClicks()       { return clicks;       }
    public double  getAdSpend()      { return adSpend;      }
    public double  getRevenue()      { return revenue;      }
    public long    getConversions()  { return conversions;  }
    public long    getBookings()     { return bookings;     }
    public long    getNewCustomers() { return newCustomers; }
    public Double  getCtr()          { return ctr;          }
    public Double  getCpc()          { return cpc;          }
    public Double  getConvRate()     { return convRate;     }
    public Double  getRoas()         { return roas;         }
    public Double  getCac()          { return cac;          }
    public Double  getPesScore()     { return pesScore;     }
    public String  getPesLabel()     { return pesLabel;     }
    public Integer getAnalysisWeeks(){ return analysisWeeks;}
    public String  getPeriodStart()  { return periodStart;  }
    public String  getPeriodEnd()    { return periodEnd;    }
    public Instant getCreatedAt()    { return createdAt;    }
    public Instant getUpdatedAt()    { return updatedAt;    }
}
