package com.ceview.module3.social.publish;

import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module3.media.*;
import com.ceview.module3.social.*;
import com.ceview.module3.social.publish.client.PlatformDeliveryClient;
import com.ceview.testsupport.TestOperators;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import java.time.OffsetDateTime;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.*;

@SpringBootTest(properties="spring.datasource.url=jdbc:h2:mem:publishing_controller;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;NON_KEYWORDS=VALUE")
@AutoConfigureMockMvc
class PublishingControllerTest {
    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;
    @Autowired TestOperators operators;
    @Autowired BusinessProfileRepository profiles;
    @Autowired SocialPostRepository posts;
    @Autowired MediaAssetRepository media;
    @Autowired PublishingAccountRepository accounts;
    @MockBean SocialConnectionService connections;
    @MockBean LocalMediaStorage storage;
    @MockBean PlatformDeliveryClient delivery;
    UUID owner,other,mediaId;
    String token,otherToken;
    @BeforeEach void setup() {
        UUID operator=UUID.randomUUID(); operators.create(operator); token=jwt.issue(operator,"publisher@example.com");
        BusinessProfile p=new BusinessProfile(); p.setUserId(operator); p.setBusinessName("Publishing tests"); owner=profiles.save(p).getBusinessProfileId();
        UUID stranger=UUID.randomUUID(); operators.create(stranger); otherToken=jwt.issue(stranger,"other@example.com");
        BusinessProfile q=new BusinessProfile(); q.setUserId(stranger); q.setBusinessName("Other business"); other=profiles.save(q).getBusinessProfileId();
        MediaAsset asset=new MediaAsset(); asset.setBusinessProfileId(owner); asset.setKind("image"); asset.setContentType("image/jpeg");
        asset.setSizeBytes(10); asset.setStorageKey("test-"+owner); asset.setPublicUrl("https://media.example/image.jpg"); asset.setStatus("READY");
        mediaId=media.save(asset).getMediaId(); when(storage.sizeOf(asset.getStorageKey())).thenReturn(OptionalLong.of(10));
        PublishingAccount a=new PublishingAccount(); a.setBusinessProfileId(owner); a.setPlatform("instagram"); a.setExternalId("ig");
        a.setAccessTokenEncrypted("NEVER-EXPOSE-CREDENTIALS"); a.setStatus("ACTIVE"); accounts.save(a);
        when(connections.list(owner)).thenReturn(List.of(new SocialDtos.SocialConnectionView("instagram",true,"ACTIVE","@mine",null)));
    }
    String request(UUID requestId) {
        return """
            {"requestId":"%s","mediaId":"%s","platforms":["instagram"],"captionsByPlatform":{"instagram":"Approved caption"},
             "visibility":"public","approved":true,"scheduledFor":"%s"}
            """.formatted(requestId,mediaId,OffsetDateTime.now().plusHours(3));
    }
    @Test void anonymousCannotUseAnyPostRoute() throws Exception {
        mvc.perform(get("/api/posts")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/posts/publish").contentType(MediaType.APPLICATION_JSON).content(request(UUID.randomUUID()))).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/posts/"+UUID.randomUUID())).andExpect(status().isUnauthorized());
    }
    @Test void rejectsForeignMediaAndUnapprovedRequest() throws Exception {
        mvc.perform(post("/api/posts/publish").header("Authorization","Bearer "+otherToken)
                .contentType(MediaType.APPLICATION_JSON).content(request(UUID.randomUUID()))).andExpect(status().isNotFound());
        mvc.perform(post("/api/posts/publish").header("Authorization","Bearer "+token)
                .contentType(MediaType.APPLICATION_JSON).content(request(UUID.randomUUID()).replace("\"approved\":true","\"approved\":false")))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(delivery);
    }
    @Test void persistsSchedulesReplaysAndIsolatesReadCancelAndAnalytics() throws Exception {
        UUID requestId=UUID.randomUUID(); String body=request(requestId);
        mvc.perform(post("/api/posts/publish").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].status").value("scheduled"))
                .andExpect(jsonPath("$[0].metricsAvailable").value(false)).andExpect(jsonPath("$[0].reach").doesNotExist())
                .andExpect(content().string(not(containsString("NEVER-EXPOSE"))));
        UUID id=posts.findByBusinessProfileIdAndRequestId(owner,requestId).get(0).getId();
        mvc.perform(post("/api/posts/publish").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(id.toString()));
        mvc.perform(get("/api/posts?operatorId="+owner).header("Authorization","Bearer "+otherToken)).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/posts/"+id).header("Authorization","Bearer "+otherToken)).andExpect(status().isNotFound());
        mvc.perform(get("/api/analytics/posts/"+id).header("Authorization","Bearer "+otherToken)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/posts/"+id).header("Authorization","Bearer "+otherToken)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/posts/"+id).header("Authorization","Bearer "+token)).andExpect(status().isNoContent());
        mvc.perform(get("/api/posts/"+id).header("Authorization","Bearer "+token)).andExpect(jsonPath("$.status").value("cancelled"));
        verifyNoInteractions(delivery);
    }
}
