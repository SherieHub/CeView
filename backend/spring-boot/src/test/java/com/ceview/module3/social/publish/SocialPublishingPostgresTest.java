package com.ceview.module3.social.publish;

import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module3.media.*;
import com.ceview.testsupport.TestOperators;
import com.ceview.auth.JwtService;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Opt-in against a disposable LOCAL Postgres database; normal suites need no Docker. */
@SpringBootTest
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named="CEVIEW_SOCIAL_POSTGRES_TEST_URL",matches="jdbc:postgresql://127\\.0\\.0\\.1:.*")
class SocialPublishingPostgresTest {
    @DynamicPropertySource static void database(DynamicPropertyRegistry p) {
        p.add("spring.datasource.url",() -> System.getenv("CEVIEW_SOCIAL_POSTGRES_TEST_URL"));
        p.add("spring.datasource.driver-class-name",() -> "org.postgresql.Driver");
        p.add("spring.datasource.username",() -> "ceview");
        p.add("spring.datasource.password",() -> "local-verification-only");
        p.add("spring.jpa.properties.hibernate.dialect",() -> "org.hibernate.dialect.PostgreSQLDialect");
        p.add("spring.jpa.hibernate.ddl-auto",() -> "validate");
        p.add("spring.flyway.enabled",() -> true);
        p.add("spring.flyway.locations",() -> "classpath:db/migration");
        p.add("ceview.social.tiktok.client-key",() -> "");
        p.add("ceview.social.tiktok.client-secret",() -> "");
    }
    @Autowired Flyway flyway;
    @Autowired SocialPostRepository posts;
    @Autowired BusinessProfileRepository profiles;
    @Autowired MediaAssetRepository media;
    @Autowired TestOperators operators;
    @Autowired PlatformTransactionManager tm;
    @Autowired JwtService jwt;
    @Autowired MockMvc mvc;

    @Test void migrationsValidateAndConcurrentDispatchersClaimDifferentRows() throws Exception {
        assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("52");
        UUID operator=UUID.randomUUID(); operators.create(operator);
        BusinessProfile profile=new BusinessProfile(); profile.setUserId(operator); profile.setBusinessName("Postgres claim verification");
        UUID owner=profiles.save(profile).getBusinessProfileId();
        MediaAsset asset=new MediaAsset(); asset.setBusinessProfileId(owner); asset.setKind("image"); asset.setContentType("image/jpeg");
        asset.setStorageKey("verification/"+owner+"/claim.jpg"); asset.setPublicUrl("https://example.test/claim.jpg"); asset.setStatus("READY"); asset.setSizeBytes(1);
        UUID mediaId=media.save(asset).getMediaId();
        for (String platform:List.of("instagram","tiktok")) {
            SocialPost post=new SocialPost(); post.setBusinessProfileId(owner); post.setRequestId(UUID.randomUUID()); post.setMediaAssetId(mediaId);
            post.setPlatform(platform); post.setCaption("Claim verification"); post.setVisibility("public"); post.setStatus("PENDING");
            post.setNextAttemptAt(OffsetDateTime.now().minusSeconds(1)); posts.saveAndFlush(post);
        }
        CountDownLatch bothClaimed=new CountDownLatch(2);
        ExecutorService pool=Executors.newFixedThreadPool(2);
        try {
            Callable<UUID> claim=() -> new TransactionTemplate(tm).execute(s -> {
                var due=posts.claimDue(OffsetDateTime.now()); assertThat(due).hasSize(1);
                SocialPost post=due.get(0); post.setStatus("PUBLISHING"); posts.saveAndFlush(post); bothClaimed.countDown();
                try { assertThat(bothClaimed.await(10,TimeUnit.SECONDS)).isTrue(); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); }
                return post.getId();
            });
            Future<UUID> first=pool.submit(claim),second=pool.submit(claim);
            assertThat(first.get(20,TimeUnit.SECONDS)).isNotEqualTo(second.get(20,TimeUnit.SECONDS));
            assertThat(posts.findByBusinessProfileIdOrderByCreatedAtDesc(owner)).allMatch(p -> "PUBLISHING".equals(p.getStatus()));
        } finally { pool.shutdownNow(); }
        String bearer="Bearer "+jwt.issue(operator,"postgres-verification@example.com");
        mvc.perform(get("/api/social-connections").header("Authorization",bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[2].configured").value(false));
        mvc.perform(post("/api/social-connections/tiktok/authorize").header("Authorization",bearer))
                .andExpect(status().isServiceUnavailable());
        mvc.perform(get("/api/posts").header("Authorization",bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
        mvc.perform(get("/api/social-connections/tiktok/callback"))
                .andExpect(status().isFound());
    }
}
