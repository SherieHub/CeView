package com.ceview.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class WebClientConfig {

    @Value("${ceview.fastapi.base-url}")
    private String fastapiBaseUrl;

    @Bean(name = "fastapiClient")
    public WebClient fastapiClient() {
        return WebClient.builder()
                .baseUrl(fastapiBaseUrl)
                .build();
    }
}
