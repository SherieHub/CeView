package com.ceview.module3.media;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.OptionalLong;
import java.util.UUID;

/**
 * Disk-backed storage for local development and tests. Files are served back by
 * {@link LocalMediaWebConfig} under {@code /media/**}, so the key layout
 * ({@code media/<profile>/<id>.<ext>}) doubles as the URL path.
 */
public class LocalMediaStorage implements MediaStorage {

    /** The stream exceeded the size cap; distinct from a bad key so callers can answer 413. */
    public static class TooLargeException extends IllegalArgumentException {
        public TooLargeException(String message) {
            super(message);
        }
    }

    private final Path root;

    public LocalMediaStorage(Path root) {
        this.root = root.toAbsolutePath().normalize();
    }

    @Override
    public String uploadUrl(UUID mediaId, String key, String contentType, long sizeBytes) {
        return "/api/media/local/" + mediaId;
    }

    /**
     * Streams {@code in} to disk, giving up as soon as it exceeds {@code maxBytes}
     * so a bad client cannot fill the disk.
     *
     * @return bytes written
     * @throws IllegalArgumentException if the key escapes the root or the stream is too large
     */
    public long write(String key, InputStream in, long maxBytes) throws IOException {
        Path target = resolve(key);
        Files.createDirectories(target.getParent());
        // Write beside the target and move into place, so a failed write never
        // clobbers (or leaves a partial copy of) a file that is already there.
        Path temp = Files.createTempFile(target.getParent(), ".upload-", ".tmp");
        long total = 0;
        try {
            try (OutputStream out = Files.newOutputStream(temp)) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = in.read(buffer)) != -1) {
                    total += read;
                    if (total > maxBytes) {
                        throw new TooLargeException("upload exceeds " + maxBytes + " bytes");
                    }
                    out.write(buffer, 0, read);
                }
            }
            Files.move(temp, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException | RuntimeException e) {
            Files.deleteIfExists(temp);
            throw e;
        }
        return total;
    }

    @Override
    public OptionalLong sizeOf(String key) {
        try {
            Path file = resolve(key);
            return Files.isRegularFile(file) ? OptionalLong.of(Files.size(file)) : OptionalLong.empty();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Override
    public void delete(String key) {
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private Path resolve(String key) {
        Path resolved = root.resolve(key).normalize();
        if (!resolved.startsWith(root)) {
            throw new IllegalArgumentException("storage key escapes the media root");
        }
        return resolved;
    }
}
