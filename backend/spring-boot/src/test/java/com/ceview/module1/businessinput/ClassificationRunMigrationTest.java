package com.ceview.module1.businessinput;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import java.sql.DriverManager;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ClassificationRunMigrationTest {
    @Test void h2MigrationCreatesRunTableWithConfirmationAndOwnershipConstraints() throws Exception {
        try (var db = DriverManager.getConnection("jdbc:h2:mem:runmigration;MODE=PostgreSQL")) {
            var statement = db.createStatement();
            statement.execute("CREATE TABLE tbl_msme_operator(operator_id UUID PRIMARY KEY)");
            statement.execute("CREATE TABLE tbl_business_profile(business_profile_id UUID PRIMARY KEY)");
            ScriptUtils.executeSqlScript(db, new ClassPathResource("db/h2/V57__classification_run.sql"));
            ScriptUtils.executeSqlScript(db, new ClassPathResource("db/h2/V58__classification_run_time_index.sql"));
            statement.execute("INSERT INTO tbl_msme_operator VALUES ('10000000-0000-0000-0000-000000000001')");
            statement.execute("""
                INSERT INTO tbl_classification_run
                (run_id, operator_id, created_at, run_purpose, input_description, input_uvp, input_services,
                 top_category, top_confidence, predicted_categories, category_scores, recommended_categories,
                 model_version, inference_latency_ms)
                VALUES ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
                        CURRENT_TIMESTAMP, 'ANALYZE', 'd', 'u', '[]', 'Coastal & Island', 0.9999988079071045,
                        '{}', '{}', '[]', 'v1', 120.25)
                """);
            var rows = statement.executeQuery("SELECT top_confidence, is_overridden FROM tbl_classification_run");
            assertThat(rows.next()).isTrue();
            assertThat(rows.getDouble(1)).isEqualTo(0.9999988079071045);
            assertThat(rows.getObject(2)).isNull();
            assertThatThrownBy(() -> statement.execute("UPDATE tbl_classification_run SET is_overridden = FALSE"))
                .isInstanceOf(java.sql.SQLException.class);
            statement.execute("DELETE FROM tbl_msme_operator");
            rows = statement.executeQuery("SELECT count(*) FROM tbl_classification_run");
            rows.next();
            assertThat(rows.getInt(1)).isZero();
        }
    }
}
