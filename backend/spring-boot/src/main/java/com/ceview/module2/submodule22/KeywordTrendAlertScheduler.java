package com.ceview.module2.submodule22;

import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/** Runs the slow weekly keyword ranking outside dashboard request handling. */
@Service
public class KeywordTrendAlertScheduler {

    private final BusinessProfileRepository profileRepo;
    private final CategoryRankNotificationService keywordTrendProducer;

    public KeywordTrendAlertScheduler(BusinessProfileRepository profileRepo,
                                      CategoryRankNotificationService keywordTrendProducer) {
        this.profileRepo = profileRepo;
        this.keywordTrendProducer = keywordTrendProducer;
    }

    /**
     * Daily retry at 00:15 UTC. The producer queries the ISO-week key first,
     * therefore only missing rows call FastAPI; existing rows are never fetched
     * again from a dashboard request.
     */
    @Scheduled(cron = "0 15 0 * * *", zone = "UTC")
    public void refreshMissingWeeklyAlerts() {
        for (BusinessProfile profile : profileRepo.findAll()) {
            keywordTrendProducer.refreshMissingCurrentWeekAlerts(
                    profile.getBusinessProfileId(), profile.categoriesList());
        }
    }
}
