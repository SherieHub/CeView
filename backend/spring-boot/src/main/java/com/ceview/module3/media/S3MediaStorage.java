package com.ceview.module3.media;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.io.InputStream;
import java.time.Duration;
import java.util.Optional;
import java.util.OptionalLong;
import java.util.UUID;

/**
 * Production storage. The browser PUTs straight to S3 with a short-lived presigned
 * URL, so large videos never pass through the API server.
 *
 * <p>Needs {@code s3:PutObject/GetObject/DeleteObject} on {@code media/*} and
 * {@code s3:ListBucket} on the bucket (without ListBucket S3 answers a HEAD on a
 * missing key with 403, not 404) — see deploy/aws/iam/media-user-policy.json.
 */
public class S3MediaStorage implements MediaStorage, AutoCloseable {

    private final S3Presigner presigner;
    private final S3Client s3;
    private final String bucket;
    private final Duration presignTtl;

    public S3MediaStorage(String bucket, String region, String accessKeyId,
                          String secretAccessKey, Duration presignTtl) {
        AwsCredentialsProvider credentials = (accessKeyId == null || accessKeyId.isBlank())
                ? DefaultCredentialsProvider.create()
                : StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKeyId, secretAccessKey));
        Region awsRegion = Region.of(region);
        this.bucket = bucket;
        this.presignTtl = presignTtl;
        this.presigner = S3Presigner.builder().region(awsRegion).credentialsProvider(credentials).build();
        this.s3 = S3Client.builder().region(awsRegion).credentialsProvider(credentials).build();
    }

    @Override
    public String uploadUrl(UUID mediaId, String key, String contentType, long sizeBytes) {
        PutObjectRequest put = PutObjectRequest.builder()
                .bucket(bucket).key(key).contentType(contentType).contentLength(sizeBytes).build();
        return presigner
                .presignPutObject(r -> r.signatureDuration(presignTtl).putObjectRequest(put))
                .url().toString();
    }

    @Override
    public OptionalLong sizeOf(String key) {
        try {
            return OptionalLong.of(s3.headObject(r -> r.bucket(bucket).key(key)).contentLength());
        } catch (S3Exception e) {
            if (e.statusCode() == 404) return OptionalLong.empty();
            throw e;
        }
    }

    @Override
    public Optional<InputStream> open(String key) {
        try {
            return Optional.of(s3.getObject(r -> r.bucket(bucket).key(key)));
        } catch (NoSuchKeyException e) {
            return Optional.empty();
        }
    }

    @Override
    public void delete(String key) {
        s3.deleteObject(r -> r.bucket(bucket).key(key));
    }

    @Override
    public void close() {
        presigner.close();
        s3.close();
    }
}
