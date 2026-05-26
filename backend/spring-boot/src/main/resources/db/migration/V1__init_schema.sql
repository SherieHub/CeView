CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Auth / Operator ─────────────────────────────────────────────────────────
CREATE TABLE tbl_msme_operator (
    operator_id      UUID PRIMARY KEY,
    first_name       VARCHAR(120),
    last_name        VARCHAR(120),
    email            VARCHAR(255) UNIQUE,
    password_hash    VARCHAR(255),
    contact_number   VARCHAR(40),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Module 1: Business Profile & Uniqueness ─────────────────────────────────
CREATE TABLE tbl_business_profile (
    business_profile_id UUID PRIMARY KEY,
    user_id             UUID REFERENCES tbl_msme_operator(operator_id) ON DELETE CASCADE,
    business_name       VARCHAR(255),
    business_type       VARCHAR(120),
    business_description TEXT,
    uvp                 TEXT,
    core_services       TEXT,  -- comma-joined; kept as TEXT in both H2 + Postgres for parity
    image_url           TEXT,
    finalized_category  VARCHAR(120),
    confidence_score    FLOAT,
    uniqueness_score    FLOAT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tbl_business_embedding (
    embedding_id           UUID PRIMARY KEY,
    business_profile_id    UUID REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE,
    embedding_vector       vector(384),
    embedding_model_version VARCHAR(60),
    generated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tbl_business_category (
    category_id          UUID PRIMARY KEY,
    category_name        VARCHAR(120) UNIQUE,
    category_description TEXT
);

CREATE TABLE tbl_business_categories_score (
    categories_score_id UUID PRIMARY KEY,
    business_profile_id UUID REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE,
    coastal_island      NUMERIC,
    adventure           NUMERIC,
    cultural            NUMERIC,
    theme_parks         NUMERIC,
    urban               NUMERIC,
    culinary            NUMERIC,
    accommodation       NUMERIC
);

CREATE TABLE tbl_classification_logs (
    log_id              UUID PRIMARY KEY,
    business_profile_id UUID REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE,
    inference_status    VARCHAR(40),
    confidence_score    FLOAT,
    execution_time      TIMESTAMPTZ DEFAULT NOW(),
    error_message       TEXT
);

-- ─── Module 2: Market Signals & Forecasting ──────────────────────────────────
CREATE TABLE tbl_market_signal_record (
    signal_record_id    UUID PRIMARY KEY,
    business_profile_id UUID REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE,
    target_market       VARCHAR(60),
    trend_index         FLOAT,
    forex_rate          FLOAT,
    gdp_growth          FLOAT,
    seasonality_score   FLOAT,
    rolling_average     FLOAT,
    spike_indicator     BOOLEAN,
    aggregated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tbl_orig_weekly_demand_value (
    demand_value_id     UUID PRIMARY KEY,
    week                TIMESTAMPTZ,
    business_profile_id UUID REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE,
    target_market       VARCHAR(60),
    beach_category      NUMERIC,
    adventure           NUMERIC,
    cultural            NUMERIC,
    theme_parks         NUMERIC,
    urban               NUMERIC,
    culinary            NUMERIC,
    accommodation       NUMERIC,
    connecting_flights  VARCHAR(120),
    market_score        NUMERIC,
    strategy            VARCHAR(255),
    forex               NUMERIC,
    gdp                 NUMERIC,
    rank                INT,
    spike_meaning       VARCHAR(255),
    current_checklist   VARCHAR(255),
    seasonality_meaning VARCHAR(255)
);

CREATE TABLE tbl_forecast_result (
    forecast_result_id  UUID PRIMARY KEY,
    business_profile_id UUID REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE,
    target_market       VARCHAR(60),
    predicted_demand    FLOAT,
    forecast_confidence FLOAT,
    mape_score          FLOAT,
    generated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tbl_market_score (
    market_score_id     UUID PRIMARY KEY,
    forecast_result_id  UUID REFERENCES tbl_forecast_result(forecast_result_id) ON DELETE CASCADE,
    market_score        FLOAT,
    seasonality_score   FLOAT,
    spike_indicator     BOOLEAN,
    evaluated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tbl_demand_alert (
    demand_alert_id  UUID PRIMARY KEY,
    market_score_id  UUID REFERENCES tbl_market_score(market_score_id) ON DELETE CASCADE,
    alert_level      VARCHAR(40),
    alert_message    TEXT,
    alert_date       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Module 3: Content / Creative / Compliance ───────────────────────────────
CREATE TABLE tbl_localized_promotional_content (
    content_id          UUID PRIMARY KEY,
    business_profile_id UUID REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE,
    selected_market     VARCHAR(60),
    platform            VARCHAR(40),
    generated_caption   TEXT,
    content_direction   TEXT,
    approval_status     BOOLEAN DEFAULT FALSE,
    generated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tbl_content_generation_log (
    content_log_id      UUID PRIMARY KEY,
    business_profile_id UUID REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE,
    generation_status   VARCHAR(40),
    diagnostics         TEXT,
    logged_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tbl_creative_direction_output (
    creative_direction_id UUID PRIMARY KEY,
    business_profile_id   UUID REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE,
    selected_market       VARCHAR(60),
    shot_list_recommendations TEXT,
    visual_recommendations    TEXT,
    lighting_suggestions      TEXT,
    moodboard_references      TEXT,
    approval_status       BOOLEAN DEFAULT FALSE,
    generated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tbl_creative_direction_log (
    creative_log_id     UUID PRIMARY KEY,
    business_profile_id UUID REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE,
    generation_status   VARCHAR(40),
    diagnostics         TEXT,
    logged_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tbl_promotional_asset (
    asset_id            UUID PRIMARY KEY,
    business_profile_id UUID REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE,
    asset_type          VARCHAR(40),
    asset_path          VARCHAR(512),
    upload_status       VARCHAR(40),
    uploaded_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tbl_compliance_evaluation_result (
    evaluation_id              UUID PRIMARY KEY,
    business_profile_id        UUID REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE,
    caption_alignment_score    FLOAT,
    visual_alignment_score     FLOAT,
    multimodal_compliance_score FLOAT,
    compliance_interpretation  TEXT,
    approval_status            BOOLEAN DEFAULT FALSE,
    evaluated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tbl_compliance_evaluation_log (
    compliance_log_id   UUID PRIMARY KEY,
    business_profile_id UUID REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE,
    evaluation_status   VARCHAR(40),
    diagnostics         TEXT,
    logged_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Module 4: Campaign Analytics ────────────────────────────────────────────
CREATE TABLE campaign_data (
    id                  UUID PRIMARY KEY,
    business_profile_id UUID REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE,
    impressions         INT,
    clicks              INT,
    ad_spend            FLOAT,
    conversions         INT,
    bookings            INT,
    revenue             FLOAT,
    new_customers       INT,
    period_start        DATE,
    period_end          DATE,
    source              VARCHAR(40)
);

CREATE TABLE campaign_metrics (
    id                UUID PRIMARY KEY,
    campaign_data_id  UUID REFERENCES campaign_data(id) ON DELETE CASCADE,
    ctr               FLOAT,
    cpc               FLOAT,
    conversion_rate   FLOAT,
    roas              FLOAT,
    cac               FLOAT,
    pes_score         FLOAT,
    computed_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE prescriptive_reports (
    id                  UUID PRIMARY KEY,
    campaign_metrics_id UUID REFERENCES campaign_metrics(id) ON DELETE CASCADE,
    executive_summary   TEXT,
    lowest_metric       VARCHAR(60),
    lowest_metric_meaning TEXT,
    recommendations     TEXT,   -- newline-joined
    other_areas_improve TEXT,   -- newline-joined
    generated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Seed: canonical tourism categories ──────────────────────────────────────
INSERT INTO tbl_business_category (category_id, category_name, category_description) VALUES
    (gen_random_uuid(), 'Beach Resort',              'Beachfront accommodation and water leisure'),
    (gen_random_uuid(), 'Urban Hotel',               'City-center hotels and business accommodations'),
    (gen_random_uuid(), 'Restaurant / Culinary',     'Dining establishments and culinary experiences'),
    (gen_random_uuid(), 'Adventure Tour',            'Outdoor adventure activities and tours'),
    (gen_random_uuid(), 'Cultural Heritage Site',    'Cultural and historical destinations'),
    (gen_random_uuid(), 'Wellness & Spa',            'Wellness retreats and spa experiences');
