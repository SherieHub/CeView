package com.ceview.module3.social.client;

import com.ceview.module3.social.SocialPlatformException;
import com.ceview.module3.social.client.MetaGraphClient.PageInfo;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MetaGraphClientTest {

    private MockWebServer server;
    private MetaGraphClient client;

    @BeforeEach
    void setUp() throws Exception {
        server = new MockWebServer();
        server.start();
        client = new MetaGraphClient(server.url("/v21.0").toString());
    }

    @AfterEach
    void tearDown() throws Exception {
        server.shutdown();
    }

    private static MockResponse json(String body) {
        return new MockResponse().setResponseCode(200).setHeader("Content-Type", "application/json").setBody(body);
    }

    @Test
    void parsesPagesWithAndWithoutALinkedInstagramAccount() {
        server.enqueue(json("""
            {"data":[
              {"id":"111","name":"Cebu Dive Co.","access_token":"PAGE-TOKEN-1",
               "instagram_business_account":{"id":"179","username":"cebu.dive"}},
              {"id":"222","name":"Mactan Cafe","access_token":"PAGE-TOKEN-2"}
            ]}"""));

        List<PageInfo> pages = client.listPages("USER-TOKEN");

        assertThat(pages).hasSize(2);
        assertThat(pages.get(0).id()).isEqualTo("111");
        assertThat(pages.get(0).name()).isEqualTo("Cebu Dive Co.");
        assertThat(pages.get(0).accessToken()).isEqualTo("PAGE-TOKEN-1");
        assertThat(pages.get(0).instagramId()).isEqualTo("179");
        assertThat(pages.get(0).instagramUsername()).isEqualTo("cebu.dive");
        assertThat(pages.get(1).instagramId()).isNull();
        assertThat(pages.get(1).instagramUsername()).isNull();
    }

    @Test
    void asksForTheFieldsItParsesAndSendsTheUserToken() throws Exception {
        server.enqueue(json("{\"data\":[]}"));

        client.listPages("USER-TOKEN");

        RecordedRequest request = server.takeRequest();
        String path = URLDecoder.decode(request.getPath(), StandardCharsets.UTF_8);
        assertThat(path).startsWith("/v21.0/me/accounts?");
        assertThat(path).contains("access_token=USER-TOKEN");
        assertThat(path).contains("instagram_business_account{id,username}");
        assertThat(path).contains("access_token,instagram_business_account");
    }

    @Test
    void anEmptyAccountYieldsAnEmptyList() {
        server.enqueue(json("{\"data\":[]}"));

        assertThat(client.listPages("USER-TOKEN")).isEmpty();
    }

    @Test
    void surfacesMetasErrorMessageWithoutLeakingTheToken() {
        server.enqueue(new MockResponse().setResponseCode(400)
                .setBody("{\"error\":{\"message\":\"Invalid OAuth access token.\",\"code\":190}}"));

        assertThatThrownBy(() -> client.listPages("USER-TOKEN-SECRET"))
                .isInstanceOf(SocialPlatformException.class)
                .hasMessageContaining("Invalid OAuth access token")
                .satisfies(e -> assertThat(e.getMessage()).doesNotContain("USER-TOKEN-SECRET"));
    }

    @Test
    void pageInfoToStringNeverPrintsTheToken() {
        PageInfo page = new PageInfo("111", "Cebu Dive Co.", "PAGE-TOKEN-1", null, null);

        assertThat(page.toString()).doesNotContain("PAGE-TOKEN-1");
    }

    @Test
    void errorCode190IsFlaggedAsAnAuthFailure() {
        server.enqueue(new MockResponse().setResponseCode(400)
                .setBody("{\"error\":{\"message\":\"Error validating access token: Session has expired\",\"code\":190}}"));

        assertThatThrownBy(() -> client.listPages("USER-TOKEN"))
                .isInstanceOfSatisfying(SocialPlatformException.class,
                        e -> assertThat(e.isAuthFailure()).isTrue());
    }

    @Test
    void otherGraphErrorsAreNotAuthFailures() {
        server.enqueue(new MockResponse().setResponseCode(400)
                .setBody("{\"error\":{\"message\":\"Unsupported get request\",\"code\":100}}"));
        assertThatThrownBy(() -> client.listPages("USER-TOKEN"))
                .isInstanceOfSatisfying(SocialPlatformException.class,
                        e -> assertThat(e.isAuthFailure()).isFalse());

        server.enqueue(new MockResponse().setResponseCode(500).setBody("boom"));
        assertThatThrownBy(() -> client.listPages("USER-TOKEN"))
                .isInstanceOfSatisfying(SocialPlatformException.class,
                        e -> assertThat(e.isAuthFailure()).isFalse());
    }
}
