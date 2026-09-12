package com.ceview.module1;

import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module2.submodule21.IngestionJobLogRepository;
import com.ceview.module2.submodule21.MarketDataIngestionJob;
import com.ceview.module2.submodule21.MarketDataIngestionService;
import com.ceview.module2.submodule22.ForecastingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Task 12 (03-spring-calibration.md): V26 seeds {@code is_reference = TRUE} rows
 * with {@code user_id NULL}. They are uniqueness-cohort material only. No read
 * outside the cohort query may surface them — a leak would drive tenant-facing
 * work (the daily market-data job, any profile listing) against businesses that
 * have no operator.
 */
// MOCK (not NONE): SecurityConfig#securityFilterChain needs a web context to
// resolve HttpSecurity, so a non-web context fails to load. This test never
// makes an HTTP call — it drives the repository and the ingestion job directly.
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
class ReferenceProfileIsolationTest {

    @Autowired private BusinessProfileRepository profileRepo;

    private UUID tenantOperatorId;

    @BeforeEach
    void seed() {
        profileRepo.deleteAll();

        var reference = new BusinessProfile();
        reference.setUserId(null);
        reference.setReference(true);
        reference.setBusinessName("Sumilon Sandbar Day Charters (reference)");
        reference.setCategoriesList(List.of("Coastal & Island"));
        profileRepo.save(reference);

        tenantOperatorId = UUID.randomUUID();
        var tenant = new BusinessProfile();
        tenant.setUserId(tenantOperatorId);
        tenant.setReference(false);
        tenant.setBusinessName("Real Operator");
        tenant.setCategoriesList(List.of("Coastal & Island"));
        profileRepo.save(tenant);
    }

    @Test
    void theSeedActuallyContainsAReferenceRow() {
        assertThat(profileRepo.findAll()).anyMatch(BusinessProfile::isReference);
    }

    @Test
    void findFirstByUserIdNeverResolvesToAReferenceRow() {
        assertThat(profileRepo.findFirstByUserId(tenantOperatorId))
            .get()
            .returns(false, BusinessProfile::isReference);
    }

    @Test
    void theOperatorFacingReadExcludesReferenceRows() {
        List<BusinessProfile> operatorOwned = profileRepo.findAllNonReference();

        assertThat(operatorOwned).noneMatch(BusinessProfile::isReference);
        assertThat(operatorOwned)
            .extracting(BusinessProfile::getBusinessName)
            .containsExactly("Real Operator");
    }

    @Test
    void everyReferenceRowHasNoOperator() {
        // The structural invariant V26 relies on: reference rows are cross-tenant
        // corpus, never owned. If one ever carried a user_id it would leak into
        // that operator's scoped reads.
        assertThat(profileRepo.findAll())
            .filteredOn(BusinessProfile::isReference)
            .isNotEmpty()
            .allSatisfy(p -> assertThat(p.getUserId()).isNull());
    }

    @Test
    void noProductionCodeSweepsTheProfileTableWithFindAll() throws IOException {
        // The one repository method that returns reference rows unfiltered is the
        // inherited findAll(). Task 12's guarantee is that no tenant-facing code
        // path calls it — cross-operator sweeps must use findAllNonReference().
        Path mainJava = Path.of("src/main/java");
        Pattern findAll = Pattern.compile("\\.findAll\\s*\\(\\s*\\)");

        List<String> offenders = new ArrayList<>();
        try (Stream<Path> paths = Files.walk(mainJava)) {
            for (Path p : (Iterable<Path>) paths
                    .filter(x -> x.toString().endsWith(".java"))::iterator) {
                String src = Files.readString(p);
                if (src.contains("BusinessProfileRepository") && findAll.matcher(src).find()) {
                    offenders.add(mainJava.relativize(p).toString());
                }
            }
        }

        assertThat(offenders)
            .as("these files reference BusinessProfileRepository and call findAll() — "
                + "switch to findAllNonReference() so the V26 corpus stays out of "
                + "tenant-facing work: %s", offenders)
            .isEmpty();
    }

    @Test
    void theDailyIngestionJobDoesNotIterateReferenceRows() {
        var ingestionService = mock(MarketDataIngestionService.class);
        when(ingestionService.ingestForProfile(any())).thenReturn(0);

        var job = new MarketDataIngestionJob(
            ingestionService, mock(ForecastingService.class), profileRepo,
            mock(IngestionJobLogRepository.class), true);

        job.runDailyIngestion();

        var processed = ArgumentCaptor.forClass(BusinessProfile.class);
        verify(ingestionService, atLeastOnce()).ingestForProfile(processed.capture());

        assertThat(processed.getAllValues()).noneMatch(BusinessProfile::isReference);
        assertThat(processed.getAllValues())
            .extracting(BusinessProfile::getBusinessName)
            .containsExactly("Real Operator");
    }
}
