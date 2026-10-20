package com.ceview.module3.social.publish;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
@ConditionalOnProperty(name="ceview.social.dispatch-enabled",havingValue="true",matchIfMissing=true)
public class SocialPostDispatcher {
    private static final Logger log=LoggerFactory.getLogger(SocialPostDispatcher.class);
    private final PublishingService service;
    public SocialPostDispatcher(PublishingService service) { this.service=service; }
    @Scheduled(fixedDelayString="${ceview.social.dispatch-delay-ms:30000}",initialDelayString="${ceview.social.dispatch-delay-ms:30000}")
    public void dispatch() {
        try {
            service.recoverInterrupted();
            for (int i=0;i<10;i++) {
                var due=service.claimDue();
                if (due.isEmpty()) break;
                due.forEach(service::deliverClaimed);
            }
            service.reconcileScheduled();
        } catch (Exception e) {
            log.warn("Social delivery polling could not complete ({})",e.getClass().getSimpleName());
        }
    }
}
