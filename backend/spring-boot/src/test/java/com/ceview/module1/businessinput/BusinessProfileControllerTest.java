package com.ceview.module1.businessinput;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.dto.BusinessProfileDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.hamcrest.Matchers.containsString;

/**
 * Verifies BusinessProfileController resolves the operator server-side from the JWT
 * (via {@link com.ceview.auth.CurrentOperator}) rather than trusting a client-supplied
 * operatorId, and that ownership of an existing profile is enforced on save.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class BusinessProfileControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private BusinessProfileRepository profileRepo;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private com.ceview.testsupport.TestOperators testOperators;

    // Stub out the AI gateway so save() doesn't attempt a real HTTP call to FastAPI.
    @MockBean private AIInferenceGatewayService ai;

    private UUID operatorA;
    private UUID operatorB;
    private String tokenA;
    private String tokenB;

    /** The pre-structured-inputs request shape: no answers, no edited flags. */
    private static BusinessProfileDto legacyDto(UUID id, String name, List<String> categories,
                                                List<String> services, String description, String uvp,
                                                String imagePreview, Float score) {
        return new BusinessProfileDto(id, name, categories, services, description, uvp, imagePreview, score,
            null, null, null, null, null, null, null, null, null);
    }

    private static final String STORY = "Sunset Cove is a beachfront resort located in Moalboal, Cebu. ...";
    private static final String UVP = "Our diving activities are guided by local Moalboal residents. ...";

    /** A full set of answers that meet every minimum, with untouched composed paragraphs. */
    private static BusinessProfileDto structuredDto(String type, String location, String experience,
                                                    String facilities, String distinguisher, String fact,
                                                    String benefit, String description, String uvp) {
        return new BusinessProfileDto(null, "Sunset Cove", List.of("Coastal & Island"), List.of("Scuba diving"),
            description, uvp, null, null,
            type, location, experience, facilities, distinguisher, fact, benefit, false, false);
    }

    private static BusinessProfileDto validStructuredDto() {
        return structuredDto("beachfront resort", "Moalboal, Cebu",
            "stay near the sardine run and explore the reef",
            "twelve villas, a dive shop, and a kitchen",
            "Our diving activities are guided by locals.",
            "Our house reef is thirty metres from the villas.",
            "Guests reach the reef easily and learn from locals.",
            STORY, UVP);
    }

    private org.springframework.test.web.servlet.ResultActions putAs(String token, BusinessProfileDto dto) throws Exception {
        return mvc.perform(put("/api/business-profile")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(dto)));
    }

    @BeforeEach
    void setUp() {
        profileRepo.deleteAll();
        operatorA = UUID.randomUUID();
        operatorB = UUID.randomUUID();
        testOperators.create(operatorA);
        testOperators.create(operatorB);
        tokenA = jwtService.issue(operatorA, "a@example.com");
        tokenB = jwtService.issue(operatorB, "b@example.com");
    }

    @Test
    void getReturnsOnlyTheAuthenticatedOperatorsOwnProfile() throws Exception {
        BusinessProfile profileA = new BusinessProfile();
        profileA.setUserId(operatorA);
        profileA.setBusinessName("Operator A's Business");
        profileRepo.save(profileA);

        BusinessProfile profileB = new BusinessProfile();
        profileB.setUserId(operatorB);
        profileB.setBusinessName("Operator B's Business");
        profileRepo.save(profileB);

        mvc.perform(get("/api/business-profile").header("Authorization", "Bearer " + tokenA))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.businessName").value("Operator A's Business"));

        mvc.perform(get("/api/business-profile").header("Authorization", "Bearer " + tokenB))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.businessName").value("Operator B's Business"));
    }

    @Test
    void putCreatesProfileOwnedByTheAuthenticatedOperatorNotAClientSuppliedId() throws Exception {
        var dto = legacyDto(null, "New Business", List.of("Retail"),
            List.of("Service A"), "desc", "uvp", null, null);

        mvc.perform(put("/api/business-profile")
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.businessName").value("New Business"));

        Optional<BusinessProfile> saved = profileRepo.findFirstByUserId(operatorA);
        assertTrue(saved.isPresent(), "profile should have been created for the authenticated operator");
        assertEquals(operatorA, saved.get().getUserId());
    }

    @Test
    void putUpdatesTheAuthenticatedOperatorsOwnExistingProfile() throws Exception {
        BusinessProfile existing = new BusinessProfile();
        existing.setUserId(operatorA);
        existing.setBusinessName("Old Name");
        profileRepo.save(existing);

        var dto = legacyDto(existing.getBusinessProfileId(), "Updated Name", List.of(),
            List.of(), "desc", "uvp", null, null);

        mvc.perform(put("/api/business-profile")
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.businessName").value("Updated Name"));

        BusinessProfile reloaded = profileRepo.findById(existing.getBusinessProfileId()).orElseThrow();
        assertEquals("Updated Name", reloaded.getBusinessName());
        assertEquals(operatorA, reloaded.getUserId());
    }

    @Test
    void putWithAnotherOperatorsBusinessProfileIdIsRejectedNotReassigned() throws Exception {
        BusinessProfile ownedByB = new BusinessProfile();
        ownedByB.setUserId(operatorB);
        ownedByB.setBusinessName("Operator B's Business");
        profileRepo.save(ownedByB);

        var dto = legacyDto(ownedByB.getBusinessProfileId(), "Hijacked Name", List.of(),
            List.of(), "desc", "uvp", null, null);

        // Operator A attempts to overwrite operator B's profile by id.
        mvc.perform(put("/api/business-profile")
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("forbidden"))
            .andExpect(jsonPath("$.message").value("business profile belongs to a different operator"));

        BusinessProfile stillB = profileRepo.findById(ownedByB.getBusinessProfileId()).orElseThrow();
        assertEquals("Operator B's Business", stillB.getBusinessName(), "profile must not be mutated");
        assertEquals(operatorB, stillB.getUserId(), "ownership must not be reassigned");
    }

    @Test
    void putWithAReferenceCorpusProfileIdIsRejectedNotAdopted() throws Exception {
        // A V26 uniqueness-corpus row: no operator, is_reference = TRUE. Its
        // businessProfileId is in the migration file, so it is not secret — the
        // controller must refuse to adopt it rather than fall into the
        // null-userId adoption branch.
        BusinessProfile reference = new BusinessProfile();
        reference.setUserId(null);
        reference.setReference(true);
        reference.setBusinessName("Reference Corpus Row");
        profileRepo.save(reference);

        var dto = legacyDto(reference.getBusinessProfileId(), "Hijacked Name", List.of(),
            List.of(), "desc", "uvp", null, null);

        mvc.perform(put("/api/business-profile")
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
            .andExpect(status().isForbidden());

        BusinessProfile still = profileRepo.findById(reference.getBusinessProfileId()).orElseThrow();
        assertEquals("Reference Corpus Row", still.getBusinessName(), "reference row must not be mutated");
        assertNull(still.getUserId(), "reference row must not be adopted by an operator");
        assertTrue(still.isReference(), "reference flag must survive");
    }

    @Test
    void putAdoptsAnOwnerlessProfileForTheAuthenticatedOperator() throws Exception {
        // A null userId is an orphaned/pre-auth row, not another operator's data — by
        // design it's treated as adoptable by whichever authenticated operator saves
        // against its (unguessable) businessProfileId. See BusinessProfileController#save.
        BusinessProfile ownerless = new BusinessProfile();
        ownerless.setUserId(null);
        ownerless.setBusinessName("Ownerless Business");
        profileRepo.save(ownerless);

        var dto = legacyDto(ownerless.getBusinessProfileId(), "Adopted Business", List.of(),
            List.of(), "desc", "uvp", null, null);

        mvc.perform(put("/api/business-profile")
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.businessName").value("Adopted Business"));

        BusinessProfile reloaded = profileRepo.findById(ownerless.getBusinessProfileId()).orElseThrow();
        assertEquals(operatorA, reloaded.getUserId(), "ownerless profile should now belong to the saving operator");
    }

    // ── Structured Business Story / UVP answers ─────────────────────────────

    @Test
    void putPersistsAndReturnsTheStructuredAnswersAndEditedFlags() throws Exception {
        putAs(tokenA, validStructuredDto())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.storyLocation").value("Moalboal, Cebu"))
            .andExpect(jsonPath("$.uvpGuestBenefit").value("Guests reach the reef easily and learn from locals."))
            .andExpect(jsonPath("$.descriptionEdited").value(false));

        BusinessProfile saved = profileRepo.findFirstByUserId(operatorA).orElseThrow();
        assertEquals("beachfront resort", saved.getStoryBusinessType());
        assertEquals("twelve villas, a dive shop, and a kitchen", saved.getStoryFacilities());
        assertEquals("Our house reef is thirty metres from the villas.", saved.getUvpSupportingFact());
        assertEquals(STORY, saved.getBusinessDescription());
        assertFalse(saved.isDescriptionEdited());
        assertFalse(saved.isUvpEdited());

        mvc.perform(get("/api/business-profile").header("Authorization", "Bearer " + tokenA))
            .andExpect(jsonPath("$.storyBusinessType").value("beachfront resort"))
            .andExpect(jsonPath("$.uvpDistinguisher").value("Our diving activities are guided by locals."))
            .andExpect(jsonPath("$.uvpEdited").value(false));
    }

    @Test
    void putAcceptsAllBlankAnswersAndKeepsLegacyProseAsHandEdited() throws Exception {
        putAs(tokenA, legacyDto(null, "Legacy Resort", List.of("Coastal & Island"), List.of("Diving"),
                "Prose written before structured inputs.", "A prose UVP.", null, null))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.descriptionEdited").value(true))
            .andExpect(jsonPath("$.uvpEdited").value(true));

        BusinessProfile saved = profileRepo.findFirstByUserId(operatorA).orElseThrow();
        assertEquals("Prose written before structured inputs.", saved.getBusinessDescription());
        assertNull(saved.getStoryLocation());
    }

    @Test
    void putRejectsPartiallyFilledAnswers() throws Exception {
        var partial = structuredDto("beachfront resort", "Moalboal, Cebu", "", "", "", "", "", STORY, UVP);
        putAs(tokenA, partial)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value(containsString("storyExperience")));
        assertTrue(profileRepo.findFirstByUserId(operatorA).isEmpty(), "nothing may be saved");
    }

    @Test
    void putRejectsAShortAnswerAtTheMinimumBoundary() throws Exception {
        var v = validStructuredDto();
        var shortLocation = structuredDto(v.storyBusinessType(), "Ce", v.storyExperience(), v.storyFacilities(),
            v.uvpDistinguisher(), v.uvpSupportingFact(), v.uvpGuestBenefit(), STORY, UVP);
        putAs(tokenA, shortLocation)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value(containsString("storyLocation must be at least 3 characters")));

        var shortBenefit = structuredDto(v.storyBusinessType(), v.storyLocation(), v.storyExperience(),
            v.storyFacilities(), v.uvpDistinguisher(), v.uvpSupportingFact(), "x".repeat(19), STORY, UVP);
        putAs(tokenA, shortBenefit)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value(containsString("uvpGuestBenefit must be at least 20 characters")));

        // Exactly at the minimum, counted after trimming, passes.
        var atMinimum = structuredDto(v.storyBusinessType(), "  Ceb  ", v.storyExperience(), v.storyFacilities(),
            v.uvpDistinguisher(), v.uvpSupportingFact(), "x".repeat(20), STORY, UVP);
        putAs(tokenA, atMinimum).andExpect(status().isOk());
    }

    @Test
    void putRejectsABlankParagraphWhenAnswersAreGiven() throws Exception {
        var v = validStructuredDto();
        var blankUvp = structuredDto(v.storyBusinessType(), v.storyLocation(), v.storyExperience(),
            v.storyFacilities(), v.uvpDistinguisher(), v.uvpSupportingFact(), v.uvpGuestBenefit(), STORY, "  ");
        putAs(tokenA, blankUvp)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value(containsString("uvp")));
    }
}
