package com.ceview.testsupport;

import com.ceview.auth.MsmeOperator;
import com.ceview.auth.MsmeOperatorRepository;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Seeds {@code tbl_msme_operator} rows in integration tests.
 *
 * <p>{@code CurrentOperator.resolve()} rejects (401) a JWT whose operator id has
 * no row in {@code tbl_msme_operator} — a guard against a token outliving its
 * account. The {@code @SpringBootTest} controller tests mint their own JWTs for
 * random operator ids, so each such id needs a matching operator row or every
 * authenticated request 401s.
 *
 * <p>Autowire this and call {@link #create(UUID)} alongside every
 * {@code jwtService.issue(id, ...)}.
 */
@Component
public class TestOperators {

    private final MsmeOperatorRepository repo;

    public TestOperators(MsmeOperatorRepository repo) {
        this.repo = repo;
    }

    /**
     * Insert a fully-onboarded operator row for {@code operatorId}; a no-op if it
     * already exists. A {@code contactNumber} is set so {@code ProfileCompletionFilter}
     * (which gates on {@code MsmeOperator.isProfileCompleted()}) lets the request through.
     */
    public UUID create(UUID operatorId) {
        if (repo.existsById(operatorId)) {
            return operatorId;
        }
        MsmeOperator op = new MsmeOperator();
        op.setOperatorId(operatorId);
        op.setEmail("op-" + operatorId + "@example.com");
        op.setContactNumber("+639170000000");
        repo.save(op);
        return operatorId;
    }
}
