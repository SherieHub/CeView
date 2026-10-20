package com.ceview.module3.social.publish;

import com.ceview.common.crypto.TokenCipher;
import com.ceview.module3.media.*;
import com.ceview.module3.social.*;
import com.ceview.module3.social.publish.PublishingDtos.*;
import com.ceview.module3.social.publish.client.*;
import com.ceview.module3.submodule31.LocalizedPromotionalContentRepository;
import com.ceview.module4.attribution.link.AttributionLinkRepository;
import com.ceview.module4.adconnections.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.dao.DataIntegrityViolationException;
import java.time.OffsetDateTime;
import java.util.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/** Validates the whole request before creating work; remote calls never hold a DB transaction. */
@Service
public class PublishingService {
    private static final Set<String> PLATFORMS = Set.of("facebook","instagram","tiktok","meta_ads");
    private final SocialPostRepository posts;
    private final MediaAssetRepository media;
    private final MediaStorage storage;
    private final PublishingAccountRepository accounts;
    private final SocialConnectionService connections;
    private final LocalizedPromotionalContentRepository content;
    private final AttributionLinkRepository links;
    private final AdPlatformConnectionRepository ads;
    private final PlatformDeliveryClient delivery;
    private final TikTokDeliveryClient tiktok;
    private final TokenCipher cipher;
    private final TransactionTemplate tx;
    private final ObjectMapper mapper;

    public PublishingService(SocialPostRepository posts, MediaAssetRepository media, MediaStorage storage,
            PublishingAccountRepository accounts, SocialConnectionService connections,
            LocalizedPromotionalContentRepository content, AttributionLinkRepository links,
            AdPlatformConnectionRepository ads, PlatformDeliveryClient delivery, TikTokDeliveryClient tiktok,
            TokenCipher cipher, PlatformTransactionManager tm, ObjectMapper mapper) {
        this.posts=posts; this.media=media; this.storage=storage; this.accounts=accounts;
        this.connections=connections; this.content=content; this.links=links; this.ads=ads;
        this.delivery=delivery; this.tiktok=tiktok; this.cipher=cipher; this.tx=new TransactionTemplate(tm); this.mapper=mapper;
    }

    public List<SocialPost> publish(UUID profile, PublishRequest request) {
        String fingerprint = fingerprint(request);
        List<SocialPost> existing = posts.findByBusinessProfileIdAndRequestId(profile,request.requestId());
        if (!existing.isEmpty()) return replay(existing,fingerprint);
        if (!cipher.isConfigured()) throw error(HttpStatus.SERVICE_UNAVAILABLE,"Token encryption is not configured");
        validate(request);
        MediaAsset asset = readyMedia(profile,request.mediaId());
        if (request.contentId()!=null) {
            var approved = content.findByBusinessProfileIdAndApprovalStatusTrue(profile).stream()
                    .anyMatch(c -> request.contentId().equals(c.getContentId()));
            if (!approved) throw error(HttpStatus.CONFLICT,"Content must belong to you and be approved");
        }
        Map<String,SocialDtos.SocialConnectionView> state = new HashMap<>();
        connections.list(profile).forEach(c -> state.put(c.platform(),c));
        List<SocialPost> created = new ArrayList<>();
        String slug = null;
        String adAccountId = null;
        if (request.platforms().contains("meta_ads")) {
            AdOptions ad = request.ad();
            if (ad==null) throw error(HttpStatus.BAD_REQUEST,"Ad settings are required");
            validateAd(ad);
            slug = links.findByLinkIdAndBusinessProfileId(ad.attributionLinkId(),profile)
                    .orElseThrow(() -> error(HttpStatus.NOT_FOUND,"Attribution link not found")).getSlug();
            var connection = ads.findByBusinessProfileIdAndProvider(profile,"meta")
                    .orElseThrow(() -> error(HttpStatus.CONFLICT,"Connect a Meta ad account first"));
            if (!"ACTIVE".equals(connection.getStatus()) || connection.getExternalAccountId()==null
                    || !scopes(connection.getScopes()).contains("ads_management"))
                throw error(HttpStatus.CONFLICT,"Choose a Meta ad account and grant ads management access");
            adAccountId=connection.getExternalAccountId().replaceFirst("^act_", "");
        }
        for (String platform: request.platforms()) {
            String accountPlatform = platform.equals("meta_ads") ? "facebook" : platform;
            var view = state.get(accountPlatform);
            if (view!=null && !view.configured()) throw error(HttpStatus.SERVICE_UNAVAILABLE,"Publishing is not configured for "+accountPlatform);
            if (view==null || !"ACTIVE".equals(view.status()))
                throw error(HttpStatus.CONFLICT,"Connect "+accountPlatform+" before publishing");
            PublishingAccount account = requireAccount(profile,accountPlatform);
            validateFormat(platform,asset);
            SocialPost post = new SocialPost();
            post.setId(UUID.randomUUID()); post.setBusinessProfileId(profile); post.setRequestId(request.requestId());
            post.setRequestFingerprint(fingerprint); post.setMediaAssetId(asset.getMediaId());
            post.setPublishingAccountId(account.getAccountId()); post.setTargetExternalId(account.getExternalId());
            post.setContentId(request.contentId()); post.setMarket(request.market()); post.setPlatform(platform);
            post.setCaption(request.captionsByPlatform().get(platform)); post.setVisibility(request.visibility());
            post.setScheduledFor(request.scheduledFor()); post.setStatus("PENDING");
            post.setNextAttemptAt(request.scheduledFor()==null || platform.equals("facebook") || platform.equals("meta_ads")
                    ? OffsetDateTime.now() : request.scheduledFor());
            if (platform.equals("meta_ads")) {
                AdOptions ad=request.ad(); post.setAdObjective(ad.objective()); post.setAdDailyBudgetMinor(ad.dailyBudgetMinor());
                post.setAdStartTime(ad.startTime()); post.setAdEndTime(ad.endTime());
                post.setAdCountries(String.join(",",ad.countries())); post.setAttributionSlug(slug); post.setPinCampaign(ad.pinCampaign());
                post.setAdAccountExternalId(adAccountId);
            }
            created.add(post);
        }
        try { tx.executeWithoutResult(s -> posts.saveAllAndFlush(created)); }
        catch (DataIntegrityViolationException e) {
            var concurrent=posts.findByBusinessProfileIdAndRequestId(profile,request.requestId());
            if (concurrent.isEmpty()) throw e;
            return replay(concurrent,fingerprint);
        }
        for (SocialPost post:created) if (!post.getNextAttemptAt().isAfter(OffsetDateTime.now())) dispatch(profile,post.getId());
        return posts.findByBusinessProfileIdAndRequestId(profile,request.requestId());
    }

    public List<SocialPost> list(UUID profile) { return posts.findByBusinessProfileIdOrderByCreatedAtDesc(profile); }
    public SocialPost get(UUID profile, UUID id) {
        return posts.findByIdAndBusinessProfileId(id,profile).orElseThrow(() -> error(HttpStatus.NOT_FOUND,"Post not found"));
    }

    public void dispatch(UUID profile, UUID id) {
        SocialPost claimed=tx.execute(s -> {
            SocialPost post=posts.lockOwned(id,profile).orElse(null);
            if (post==null || !"PENDING".equals(post.getStatus()) || post.getNextAttemptAt().isAfter(OffsetDateTime.now())) return null;
            claim(post); return posts.saveAndFlush(post);
        });
        if (claimed!=null) deliverClaimed(claimed);
    }

    public List<SocialPost> claimDue() {
        return tx.execute(s -> {
            List<SocialPost> due=posts.claimDue(OffsetDateTime.now());
            due.forEach(this::claim); posts.saveAllAndFlush(due); return due;
        });
    }
    private void claim(SocialPost p) {
        p.setStatus("PUBLISHING"); p.setClaimedAt(OffsetDateTime.now()); p.setAttempts(p.getAttempts()+1);
        if (p.getProcessingStartedAt()==null) p.setProcessingStartedAt(OffsetDateTime.now());
    }

    public void deliverClaimed(SocialPost post) {
        try {
            MediaAsset asset=readyMedia(post.getBusinessProfileId(),post.getMediaAssetId());
            PublishingAccount account=boundAccount(post);
            String token=accessToken(account);
            var result=delivery.deliver(post,asset,account,token,this::checkpoint);
            post.setStatus(result.status()); post.setExternalId(result.externalId());
            post.setPermalink(result.permalink()); post.setAdsManagerUrl(result.adsManagerUrl());
            if ("PUBLISHED".equals(result.status()) && !"meta_ads".equals(post.getPlatform())) post.setPublishedAt(OffsetDateTime.now());
            post.setErrorMessage(null); post.setClaimedAt(null); checkpoint(post);
        } catch (ProcessingPendingException pending) {
            // Processing polls are not failed delivery attempts; bounded by container age.
            if (post.getProcessingStartedAt()!=null && post.getProcessingStartedAt().isBefore(OffsetDateTime.now().minusHours(24))) fail(post,"Platform media processing timed out");
            else { post.setAttempts(Math.max(0,post.getAttempts()-1)); retry(post,"Platform is processing the media",30); }
        } catch (DeliveryException e) {
            if (e.isAuthFailure()) {
                markReconnect(post);
            }
            if (e.isRetryable() && post.getAttempts()<3) retry(post,e.getMessage(),60L*post.getAttempts());
            else fail(post,e.getMessage());
        } catch (ResponseStatusException e) { fail(post,e.getReason()); }
        catch (Exception e) {
            // An unknown outcome must not automatically repeat an external write.
            fail(post,"Delivery could not be confirmed. Check the platform before trying again.");
        }
    }

    public void checkpoint(SocialPost post) {
        SocialPost saved=tx.execute(s -> posts.saveAndFlush(post));
        post.setVersion(saved.getVersion());
    }
    private void retry(SocialPost post,String message,long seconds) {
        post.setStatus("PENDING"); post.setClaimedAt(null); post.setErrorMessage(message);
        post.setNextAttemptAt(OffsetDateTime.now().plusSeconds(seconds)); checkpoint(post);
    }
    private void fail(SocialPost post,String message) {
        post.setStatus("FAILED"); post.setClaimedAt(null); post.setErrorMessage(message); checkpoint(post);
    }

    /** A crashed process may have completed a remote write. Do not blindly repost it. */
    public void recoverInterrupted() {
        tx.executeWithoutResult(s -> posts.findByStatusAndClaimedAtBefore("PUBLISHING",OffsetDateTime.now().minusMinutes(15))
                .forEach(p -> {
                    p.setStatus("FAILED"); p.setClaimedAt(null);
                    p.setErrorMessage("Delivery was interrupted. Check the platform before creating another post.");
                    posts.save(p);
                }));
    }

    public void reconcileScheduled() {
        for (SocialPost post:posts.findByStatusIn(List.of("SCHEDULED_ON_PLATFORM"))) {
            if (post.getScheduledFor()!=null && post.getScheduledFor().isAfter(OffsetDateTime.now())) continue;
            try {
                PublishingAccount a=boundAccount(post);
                var result=delivery.reconcileScheduled(post,a,accessToken(a));
                if ("PUBLISHED".equals(result.status())) {
                    post.setStatus(result.status()); post.setPermalink(result.permalink());
                    post.setPublishedAt(OffsetDateTime.now()); checkpoint(post);
                }
            } catch (DeliveryException e) {
                if (e.isAuthFailure()) markReconnect(post);
                if (!e.isRetryable() && !e.isAuthFailure()) fail(post,e.getMessage());
            } catch (ResponseStatusException e) {
                // Revoked/replaced credentials cannot confirm a remote schedule; preserve it and explain.
                post.setErrorMessage("Reconnect the original account to check or cancel this platform schedule."); checkpoint(post);
            } catch (Exception ignored) { /* A transient read failure does not prove publication failed. */ }
        }
    }

    public void cancel(UUID profile,UUID id) {
        SocialPost post=tx.execute(s -> {
            SocialPost p=posts.lockOwned(id,profile).orElseThrow(() -> error(HttpStatus.NOT_FOUND,"Post not found"));
            if ("CANCELLED".equals(p.getStatus())) return p;
            if (!Set.of("PENDING","SCHEDULED_ON_PLATFORM").contains(p.getStatus()))
                throw error(HttpStatus.CONFLICT,"Only pending or scheduled posts can be cancelled");
            if ("tiktok".equals(p.getPlatform()) && p.getExternalId()!=null)
                throw error(HttpStatus.CONFLICT,"TikTok already accepted this upload. Manage the draft in TikTok.");
            if ("PENDING".equals(p.getStatus()) && !("facebook".equals(p.getPlatform()) && p.getContainerId()!=null)) p.setStatus("CANCELLED");
            else { p.setStatus("PUBLISHING"); p.setClaimedAt(OffsetDateTime.now()); }
            return posts.saveAndFlush(p);
        });
        if ("CANCELLED".equals(post.getStatus())) return;
        try {
            PublishingAccount a=boundAccount(post); delivery.cancel(post,a,accessToken(a));
            post.setStatus("CANCELLED"); post.setClaimedAt(null); checkpoint(post);
        } catch (Exception e) {
            post.setStatus("SCHEDULED_ON_PLATFORM"); post.setClaimedAt(null); checkpoint(post);
            throw error(HttpStatus.BAD_GATEWAY,"Could not cancel the platform schedule. Check Facebook before retrying.");
        }
    }

    private PublishingAccount boundAccount(SocialPost post) {
        PublishingAccount a=requireAccount(post.getBusinessProfileId(),accountPlatform(post));
        if (!Objects.equals(a.getAccountId(),post.getPublishingAccountId()) || !Objects.equals(a.getExternalId(),post.getTargetExternalId()))
            throw error(HttpStatus.CONFLICT,"The connected account changed. Create a new post for the current account.");
        boolean active=connections.list(post.getBusinessProfileId()).stream()
                .anyMatch(v -> v.platform().equals(accountPlatform(post)) && "ACTIVE".equals(v.status()));
        if (!active) throw error(HttpStatus.CONFLICT,"Reconnect the platform before publishing");
        return a;
    }
    public String accessTokenForMetrics(SocialPost post) {
        if (!"meta_ads".equals(post.getPlatform())) return accessToken(boundAccount(post));
        var connection=ads.findByBusinessProfileIdAndProvider(post.getBusinessProfileId(),"meta")
                .filter(c -> "ACTIVE".equals(c.getStatus()) && scopes(c.getScopes()).contains("ads_read"))
                .filter(c -> c.getExternalAccountId()!=null && c.getExternalAccountId().replaceFirst("^act_", "").equals(post.getAdAccountExternalId()))
                .filter(c -> c.getTokenExpiresAt()==null || c.getTokenExpiresAt().isAfter(OffsetDateTime.now()))
                .orElseThrow(() -> error(HttpStatus.CONFLICT,"Reconnect the original Meta ad account to read these insights"));
        return cipher.decrypt(connection.getAccessTokenEncrypted());
    }

    private String accessToken(PublishingAccount a) {
        if (!"tiktok".equals(a.getPlatform())) return cipher.decrypt(a.getAccessTokenEncrypted());
        OffsetDateTime lease=OffsetDateTime.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        PublishingAccount current=tx.execute(s -> {
            PublishingAccount fresh=accounts.lockOwned(a.getBusinessProfileId(),a.getPlatform()).orElseThrow(() -> error(HttpStatus.CONFLICT,"Reconnect TikTok"));
            if (!"ACTIVE".equals(fresh.getStatus()) || !Objects.equals(a.getExternalId(),fresh.getExternalId()))
                throw error(HttpStatus.CONFLICT,"Reconnect TikTok");
            if (fresh.getTokenExpiresAt()==null || fresh.getTokenExpiresAt().isAfter(lease.plusMinutes(2))) return fresh;
            if (fresh.getRefreshClaimedAt()!=null && fresh.getRefreshClaimedAt().isAfter(lease.minusMinutes(2)))
                throw new DeliveryException("TikTok credentials are refreshing. Delivery will retry.",false,true);
            if (fresh.getRefreshTokenEncrypted()==null || (fresh.getRefreshExpiresAt()!=null && !fresh.getRefreshExpiresAt().isAfter(lease)))
                throw new DeliveryException("Reconnect TikTok.",true,false);
            fresh.setRefreshClaimedAt(lease); return accounts.saveAndFlush(fresh);
        });
        if (!lease.equals(current.getRefreshClaimedAt())) return cipher.decrypt(current.getAccessTokenEncrypted());
        String original=current.getAccessTokenEncrypted();
        try {
            var grant=tiktok.refreshToken(cipher.decrypt(current.getRefreshTokenEncrypted()));
            if (grant.openId()!=null && !grant.openId().isBlank() && !grant.openId().equals(current.getExternalId()))
                throw new DeliveryException("TikTok refreshed a different account. Reconnect TikTok.",true,false);
            return tx.execute(s -> {
                PublishingAccount fresh=accounts.lockOwned(a.getBusinessProfileId(),a.getPlatform()).orElseThrow();
                if (!"ACTIVE".equals(fresh.getStatus()) || !Objects.equals(original,fresh.getAccessTokenEncrypted())
                        || !Objects.equals(lease,fresh.getRefreshClaimedAt()))
                    throw error(HttpStatus.CONFLICT,"TikTok connection changed while refreshing. Try again.");
                fresh.setAccessTokenEncrypted(cipher.encrypt(grant.accessToken()));
                if (grant.refreshToken()!=null) fresh.setRefreshTokenEncrypted(cipher.encrypt(grant.refreshToken()));
                fresh.setTokenExpiresAt(grant.accessExpiresAt()); fresh.setRefreshExpiresAt(grant.refreshExpiresAt());
                if (grant.scopes()!=null) fresh.setScopes(grant.scopes()); fresh.setRefreshClaimedAt(null); accounts.saveAndFlush(fresh);
                return grant.accessToken();
            });
        } finally {
            tx.executeWithoutResult(s -> accounts.lockOwned(a.getBusinessProfileId(),a.getPlatform()).ifPresent(fresh -> {
                if (Objects.equals(original,fresh.getAccessTokenEncrypted()) && Objects.equals(lease,fresh.getRefreshClaimedAt())) {
                    fresh.setRefreshClaimedAt(null); accounts.save(fresh);
                }
            }));
        }
    }
    private void markReconnect(SocialPost post) {
        tx.executeWithoutResult(s -> accounts.lockOwned(post.getBusinessProfileId(),accountPlatform(post))
                .filter(a -> Objects.equals(a.getAccountId(),post.getPublishingAccountId()) && "ACTIVE".equals(a.getStatus())
                        && Objects.equals(a.getExternalId(),post.getTargetExternalId()))
                .ifPresent(a -> { a.setStatus(PublishingAccount.STATUS_NEEDS_RECONNECT); accounts.save(a); }));
    }
    private PublishingAccount requireAccount(UUID profile,String platform) {
        return accounts.findByBusinessProfileIdAndPlatform(profile,platform)
                .filter(a -> PublishingAccount.STATUS_ACTIVE.equals(a.getStatus()))
                .orElseThrow(() -> error(HttpStatus.CONFLICT,"Reconnect "+platform));
    }
    private static String accountPlatform(SocialPost p) { return "meta_ads".equals(p.getPlatform()) ? "facebook" : p.getPlatform(); }
    public MediaAsset readyMedia(UUID profile,UUID id) {
        MediaAsset a=media.findByMediaIdAndBusinessProfileId(id,profile).orElseThrow(() -> error(HttpStatus.NOT_FOUND,"Media not found"));
        if (!MediaAsset.STATUS_READY.equals(a.getStatus())) throw error(HttpStatus.CONFLICT,"Finish uploading the media first");
        if (storage.sizeOf(a.getStorageKey()).orElse(-1)!=a.getSizeBytes())
            throw error(HttpStatus.CONFLICT,"Stored media changed or is missing. Upload it again.");
        return a;
    }
    static void validate(PublishRequest r) {
        if (!r.approved()) throw error(HttpStatus.BAD_REQUEST,"Approve the post before publishing");
        if (r.platforms()==null || r.platforms().isEmpty() || !PLATFORMS.containsAll(r.platforms())
                || new HashSet<>(r.platforms()).size()!=r.platforms().size()) throw error(HttpStatus.BAD_REQUEST,"Choose valid, distinct platforms");
        if (!"public".equals(r.visibility()))
            throw error(HttpStatus.BAD_REQUEST,"Private publishing is unavailable; choose final TikTok draft privacy in TikTok");
        for (String p:r.platforms()) {
            String caption=r.captionsByPlatform().get(p);
            if (caption==null || caption.isBlank() || caption.length()> (p.equals("facebook")?63206:2200))
                throw error(HttpStatus.BAD_REQUEST,"Provide a caption within the platform limit for "+p);
        }
        if (r.scheduledFor()!=null) {
            if (!r.scheduledFor().isAfter(OffsetDateTime.now())) throw error(HttpStatus.BAD_REQUEST,"Schedule must be in the future");
            if (r.platforms().contains("facebook") && (r.scheduledFor().isBefore(OffsetDateTime.now().plusMinutes(10))
                    || r.scheduledFor().isAfter(OffsetDateTime.now().plusMonths(6))))
                throw error(HttpStatus.BAD_REQUEST,"Facebook schedules must be 10 minutes to 6 months ahead");
        }
    }
    static void validateFormat(String platform,MediaAsset media) {
        if (!"image".equals(media.getKind())) return;
        if ("instagram".equals(platform) && !"image/jpeg".equals(media.getContentType()))
            throw error(HttpStatus.BAD_REQUEST,"Instagram images must be JPEG. Upload a JPEG version.");
        if ("tiktok".equals(platform) && !Set.of("image/jpeg","image/webp").contains(media.getContentType()))
            throw error(HttpStatus.BAD_REQUEST,"TikTok photos must be JPEG or WEBP.");
    }
    static void validateAd(AdOptions ad) {
        if (!Set.of("OUTCOME_TRAFFIC","OUTCOME_AWARENESS").contains(ad.objective()) || ad.dailyBudgetMinor()<1
                || ad.startTime()==null || ad.endTime()==null || !ad.endTime().isAfter(ad.startTime())
                || !ad.endTime().isAfter(OffsetDateTime.now()) || ad.countries()==null || ad.countries().isEmpty()
                || ad.countries().stream().anyMatch(c -> c==null || !Set.of(Locale.getISOCountries()).contains(c)))
            throw error(HttpStatus.BAD_REQUEST,"Invalid ad objective, budget, dates or countries");
    }
    private String fingerprint(PublishRequest r) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(mapper.copy()
                .configure(com.fasterxml.jackson.databind.SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS,true)
                .writeValueAsString(r).getBytes(StandardCharsets.UTF_8))); }
        catch (Exception e) { throw error(HttpStatus.BAD_REQUEST,"Invalid publishing request"); }
    }
    private static List<SocialPost> replay(List<SocialPost> p,String fingerprint) {
        if (p.stream().anyMatch(x -> !Objects.equals(x.getRequestFingerprint(),fingerprint)))
            throw error(HttpStatus.CONFLICT,"This request ID was already used for different content");
        return p;
    }
    private static Set<String> scopes(String value) { return value==null ? Set.of() : new HashSet<>(Arrays.asList(value.split("[,\\s]+"))); }
    private static ResponseStatusException error(HttpStatus status,String message) { return new ResponseStatusException(status,message); }
}
