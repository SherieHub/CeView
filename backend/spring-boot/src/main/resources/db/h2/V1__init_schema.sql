-- H2-compatible schema. Mirrors db/migration/V1__init_schema.sql except:
--   • vector(384)                → VARCHAR(8000) (JSON-encoded array placeholder)
--   • text[] / VARCHAR[]         → CLOB         (comma-joined)
--   • TIMESTAMPTZ                → TIMESTAMP    (H2 doesn't have TZ in PG mode here)
--   • pgcrypto gen_random_uuid() → RANDOM_UUID()
--
-- pgvector is NOT installed; embedding similarity will be a stub on H2.
-- Use the Postgres migration for production.

CREATE TABLE tbl_msme_operator (
    operator_id      UUID PRIMARY KEY,
    first_name       VARCHAR(120),
    last_name        VARCHAR(120),
    email            VARCHAR(255) UNIQUE,
    password_hash    VARCHAR(255),
    contact_number   VARCHAR(40),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tbl_business_profile (
    business_profile_id UUID PRIMARY KEY,
    user_id             UUID,
    business_name       VARCHAR(255),
    business_type       VARCHAR(120),
    business_description CLOB,
    uvp                 CLOB,
    core_services       CLOB,
    image_url           CLOB,
    finalized_category  VARCHAR(120),
    confidence_score    FLOAT,
    uniqueness_score    FLOAT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES tbl_msme_operator(operator_id) ON DELETE CASCADE
);

CREATE TABLE tbl_business_embedding (
    embedding_id            UUID PRIMARY KEY,
    business_profile_id     UUID,
    embedding_vector        VARCHAR(8000),
    embedding_model_version VARCHAR(60),
    generated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_profile_id) REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE
);

CREATE TABLE tbl_business_category (
    category_id          UUID PRIMARY KEY,
    category_name        VARCHAR(120) UNIQUE,
    category_description CLOB
);

CREATE TABLE tbl_business_categories_score (
    categories_score_id UUID PRIMARY KEY,
    business_profile_id UUID,
    coastal_island      DECIMAL,
    adventure           DECIMAL,
    cultural            DECIMAL,
    theme_parks         DECIMAL,
    urban               DECIMAL,
    culinary            DECIMAL,
    accommodation       DECIMAL,
    FOREIGN KEY (business_profile_id) REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE
);

CREATE TABLE tbl_classification_logs (
    log_id              UUID PRIMARY KEY,
    business_profile_id UUID,
    inference_status    VARCHAR(40),
    confidence_score    FLOAT,
    execution_time      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    error_message       CLOB,
    FOREIGN KEY (business_profile_id) REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE
);

CREATE TABLE tbl_market_signal_record (
    signal_record_id    UUID PRIMARY KEY,
    business_profile_id UUID,
    target_market       VARCHAR(60),
    trend_index         FLOAT,
    forex_rate          FLOAT,
    gdp_growth          FLOAT,
    seasonality_score   FLOAT,
    rolling_average     FLOAT,
    spike_indicator     BOOLEAN,
    aggregated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_profile_id) REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE
);

CREATE TABLE tbl_orig_weekly_demand_value (
    demand_value_id     UUID PRIMARY KEY,
    week                TIMESTAMP,
    business_profile_id UUID,
    target_market       VARCHAR(60),
    beach_category      DECIMAL,
    adventure           DECIMAL,
    cultural            DECIMAL,
    theme_parks         DECIMAL,
    urban               DECIMAL,
    culinary            DECIMAL,
    accommodation       DECIMAL,
    connecting_flights  VARCHAR(120),
    market_score        DECIMAL,
    strategy            VARCHAR(255),
    forex               DECIMAL,
    gdp                 DECIMAL,
    rank_value          INT,
    spike_meaning       VARCHAR(255),
    current_checklist   VARCHAR(255),
    seasonality_meaning VARCHAR(255),
    FOREIGN KEY (business_profile_id) REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE
);

CREATE TABLE tbl_forecast_result (
    forecast_result_id  UUID PRIMARY KEY,
    business_profile_id UUID,
    target_market       VARCHAR(60),
    predicted_demand    FLOAT,
    forecast_confidence FLOAT,
    mape_score          FLOAT,
    generated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_profile_id) REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE
);

CREATE TABLE tbl_market_score (
    market_score_id     UUID PRIMARY KEY,
    forecast_result_id  UUID,
    market_score        FLOAT,
    seasonality_score   FLOAT,
    spike_indicator     BOOLEAN,
    evaluated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (forecast_result_id) REFERENCES tbl_forecast_result(forecast_result_id) ON DELETE CASCADE
);

CREATE TABLE tbl_demand_alert (
    demand_alert_id  UUID PRIMARY KEY,
    market_score_id  UUID,
    alert_level      VARCHAR(40),
    alert_message    CLOB,
    alert_date       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (market_score_id) REFERENCES tbl_market_score(market_score_id) ON DELETE CASCADE
);

CREATE TABLE tbl_localized_promotional_content (
    content_id          UUID PRIMARY KEY,
    business_profile_id UUID,
    selected_market     VARCHAR(60),
    platform            VARCHAR(40),
    generated_caption   CLOB,
    content_direction   CLOB,
    approval_status     BOOLEAN DEFAULT FALSE,
    generated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_profile_id) REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE
);

CREATE TABLE tbl_content_generation_log (
    content_log_id      UUID PRIMARY KEY,
    business_profile_id UUID,
    generation_status   VARCHAR(40),
    diagnostics         CLOB,
    logged_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_profile_id) REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE
);

CREATE TABLE tbl_creative_direction_output (
    creative_direction_id     UUID PRIMARY KEY,
    business_profile_id       UUID,
    selected_market           VARCHAR(60),
    shot_list_recommendations CLOB,
    visual_recommendations    CLOB,
    lighting_suggestions      CLOB,
    moodboard_references      CLOB,
    approval_status           BOOLEAN DEFAULT FALSE,
    generated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_profile_id) REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE
);

CREATE TABLE tbl_creative_direction_log (
    creative_log_id     UUID PRIMARY KEY,
    business_profile_id UUID,
    generation_status   VARCHAR(40),
    diagnostics         CLOB,
    logged_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_profile_id) REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE
);

CREATE TABLE tbl_promotional_asset (
    asset_id            UUID PRIMARY KEY,
    business_profile_id UUID,
    asset_type          VARCHAR(40),
    asset_path          VARCHAR(512),
    upload_status       VARCHAR(40),
    uploaded_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_profile_id) REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE
);

CREATE TABLE tbl_compliance_evaluation_result (
    evaluation_id              UUID PRIMARY KEY,
    business_profile_id        UUID,
    caption_alignment_score    FLOAT,
    visual_alignment_score     FLOAT,
    multimodal_compliance_score FLOAT,
    compliance_interpretation  CLOB,
    approval_status            BOOLEAN DEFAULT FALSE,
    evaluated_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_profile_id) REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE
);

CREATE TABLE tbl_compliance_evaluation_log (
    compliance_log_id   UUID PRIMARY KEY,
    business_profile_id UUID,
    evaluation_status   VARCHAR(40),
    diagnostics         CLOB,
    logged_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_profile_id) REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE
);

CREATE TABLE campaign_data (
    id                  UUID PRIMARY KEY,
    business_profile_id UUID,
    impressions         INT,
    clicks              INT,
    ad_spend            FLOAT,
    conversions         INT,
    bookings            INT,
    revenue             FLOAT,
    new_customers       INT,
    period_start        DATE,
    period_end          DATE,
    source              VARCHAR(40),
    FOREIGN KEY (business_profile_id) REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE
);

CREATE TABLE campaign_metrics (
    id                UUID PRIMARY KEY,
    campaign_data_id  UUID,
    ctr               FLOAT,
    cpc               FLOAT,
    conversion_rate   FLOAT,
    roas              FLOAT,
    cac               FLOAT,
    pes_score         FLOAT,
    computed_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_data_id) REFERENCES campaign_data(id) ON DELETE CASCADE
);

CREATE TABLE prescriptive_reports (
    id                    UUID PRIMARY KEY,
    campaign_metrics_id   UUID,
    executive_summary     CLOB,
    lowest_metric         VARCHAR(60),
    lowest_metric_meaning CLOB,
    recommendations       CLOB,
    other_areas_improve   CLOB,
    generated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_metrics_id) REFERENCES campaign_metrics(id) ON DELETE CASCADE
);

INSERT INTO tbl_business_category (category_id, category_name, category_description) VALUES
    (RANDOM_UUID(), 'Beach Resort',              'Beachfront accommodation and water leisure'),
    (RANDOM_UUID(), 'Urban Hotel',               'City-center hotels and business accommodations'),
    (RANDOM_UUID(), 'Restaurant / Culinary',     'Dining establishments and culinary experiences'),
    (RANDOM_UUID(), 'Adventure Tour',            'Outdoor adventure activities and tours'),
    (RANDOM_UUID(), 'Cultural Heritage Site',    'Cultural and historical destinations'),
    (RANDOM_UUID(), 'Wellness & Spa',            'Wellness retreats and spa experiences');
