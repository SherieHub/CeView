package com.ceview;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CeViewApplication {
    public static void main(String[] args) {
        SpringApplication.run(CeViewApplication.class, args);
    }
}
