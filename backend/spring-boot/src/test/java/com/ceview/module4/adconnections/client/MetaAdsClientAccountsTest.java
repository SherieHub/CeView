package com.ceview.module4.adconnections.client;

import com.ceview.module4.adconnections.AdConnectionDtos.AdAccountOption;
import com.ceview.module4.adconnections.AdProviderProperties;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class MetaAdsClientAccountsTest {

    private MockWebServer server;
    private MetaAdsClient client;

    private static String fixture(String name) throws Exception {
        try (var in = MetaAdsClientAccountsTest.class
                .getResourceAsStream("/adplatform/" + name)) {
            assertNotNull(in, "missing test fixture: " + name);
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private MockResponse json(String body) {
        return new MockResponse().setResponseCode(200)
                .setHeader("Content-Type", "application/json").setBody(body);
    }

    @BeforeEach
    void setUp() throws Exception {
        server = new MockWebServer();
        server.start();

        AdProviderProperties props = new AdProviderProperties();
        props.getMeta().setAppId("APP123");
        props.getMeta().setAppSecret("SECRET456");
        props.setRedirectBaseUrl("https://tunnel.example.com");

        String base = server.url("/v21.0").toString();
        client = new MetaAdsClient(props, base, base + "/dialog/oauth");
    }

    @AfterEach
    void tearDown() throws Exception {
        server.shutdown();
    }

    @Test
    void parsesIdNameAndCurrency() throws Exception {
        server.enqueue(json(fixture("meta-adaccounts.json").replace("PAGE_2_URL", "")));

        List<AdAccountOption> accounts = client.listAccounts("TOKEN");

        assertEquals(2, accounts.size());
        assertEquals("act_111111111", accounts.get(0).id());
        assertEquals("Cebu Dive Co. Ads", accounts.get(0).name());
        assertEquals("PHP", accounts.get(0).currency());
        assertEquals("USD", accounts.get(1).currency());
    }

    @Test
    void requestsTheFieldsItParsesAndSendsTheToken() throws Exception {
        server.enqueue(json(fixture("meta-adaccounts.json").replace("PAGE_2_URL", "")));

        client.listAccounts("TOKEN");

        RecordedRequest request = server.takeRequest();
        String path = request.getPath();
        assertTrue(path.contains("/me/adaccounts"), path);
        assertTrue(path.contains("fields=id%2Cname%2Ccurrency")
                || path.contains("fields=id,name,currency"), path);
        assertTrue(path.contains("access_token=TOKEN"), path);
    }

    @Test
    void followsThePagingCursor() throws Exception {
        String page2Url = server.url("/v21.0/me/adaccounts?after=MjQZD").toString();
        server.enqueue(json(fixture("meta-adaccounts.json").replace("PAGE_2_URL", page2Url)));
        server.enqueue(json(fixture("meta-adaccounts-page2.json")));

        List<AdAccountOption> accounts = client.listAccounts("TOKEN");

        assertEquals(3, accounts.size(), "should include the second page");
        assertEquals("act_333333333", accounts.get(2).id());
    }

    @Test
    void returnsAnEmptyListWhenTheGrantSeesNoAdAccounts() throws Exception {
        // Common for a brand-new Meta developer account with no Business
        // Portfolio — the UI must show "no ad accounts found", not an error.
        server.enqueue(json("{\"data\":[]}"));

        assertTrue(client.listAccounts("TOKEN").isEmpty());
    }

    @Test
    void wrapsAnErrorFromThePagingRequest() throws Exception {
        String page2Url = server.url("/v21.0/me/adaccounts?after=MjQZD").toString();
        server.enqueue(json(fixture("meta-adaccounts.json").replace("PAGE_2_URL", page2Url)));
        server.enqueue(new MockResponse().setResponseCode(500)
                .setHeader("Content-Type", "application/json")
                .setBody("{\"error\":{\"message\":\"Please reduce the amount of data\"}}"));

        AdPlatformException ex = assertThrows(AdPlatformException.class,
                () -> client.listAccounts("TOKEN"));
        assertTrue(ex.getMessage().contains("Please reduce the amount of data"), ex.getMessage());
    }

    @Test
    void stopsFollowingPagingAfterTheIterationCapEvenWithEmptyPages() throws Exception {
        // A malformed or hostile response could keep handing back an empty
        // data[] with a non-blank next cursor forever; the loop must bound
        // itself on iteration count, not just accumulated row count.
        String selfUrl = server.url("/v21.0/me/adaccounts?after=LOOP").toString();
        String emptyPageWithNext = "{\"data\":[],\"paging\":{\"next\":\"" + selfUrl + "\"}}";

        for (int i = 0; i < 20; i++) {
            server.enqueue(json(emptyPageWithNext));
        }

        List<AdAccountOption> accounts = client.listAccounts("TOKEN");

        assertTrue(accounts.isEmpty());
        // First page + at most MAX_PAGES-1 further pages; well under all 20 enqueued.
        assertTrue(server.getRequestCount() <= 10, "requestCount=" + server.getRequestCount());
    }
}
