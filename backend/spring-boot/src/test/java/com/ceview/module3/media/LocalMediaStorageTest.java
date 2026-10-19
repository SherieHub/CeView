package com.ceview.module3.media;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.nio.file.Path;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LocalMediaStorageTest {

    @TempDir Path dir;

    @Test
    void writesAFileAndReportsItsSize() throws Exception {
        LocalMediaStorage storage = new LocalMediaStorage(dir);
        long written = storage.write("media/p1/a.jpg", new ByteArrayInputStream(new byte[]{1, 2, 3}), 10);

        assertThat(written).isEqualTo(3);
        assertThat(storage.sizeOf("media/p1/a.jpg")).hasValue(3);
    }

    @Test
    void reportsAMissingFileAsEmpty() {
        assertThat(new LocalMediaStorage(dir).sizeOf("media/p1/none.jpg")).isEmpty();
    }

    @Test
    void refusesAnOversizeUploadAndLeavesNothingBehind() {
        LocalMediaStorage storage = new LocalMediaStorage(dir);

        assertThatThrownBy(() ->
                storage.write("media/p1/big.jpg", new ByteArrayInputStream(new byte[100]), 10))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(storage.sizeOf("media/p1/big.jpg")).isEmpty();
    }

    @Test
    void oversizeUploadThrowsTheTooLargeException() {
        LocalMediaStorage storage = new LocalMediaStorage(dir);

        assertThatThrownBy(() ->
                storage.write("media/p1/big.jpg", new ByteArrayInputStream(new byte[100]), 10))
                .isInstanceOf(LocalMediaStorage.TooLargeException.class);
    }

    @Test
    void aFailedSecondWriteLeavesTheExistingFileIntact() throws Exception {
        LocalMediaStorage storage = new LocalMediaStorage(dir);
        storage.write("media/p1/a.jpg", new ByteArrayInputStream(new byte[]{1, 2, 3}), 10);

        assertThatThrownBy(() ->
                storage.write("media/p1/a.jpg", new ByteArrayInputStream(new byte[100]), 10))
                .isInstanceOf(IllegalArgumentException.class);

        assertThat(storage.sizeOf("media/p1/a.jpg")).hasValue(3);
        try (var files = java.nio.file.Files.list(dir.resolve("media/p1"))) {
            assertThat(files.map(f -> f.getFileName().toString())).containsExactly("a.jpg");
        }
    }

    @Test
    void deleteRemovesTheFile() throws Exception {
        LocalMediaStorage storage = new LocalMediaStorage(dir);
        storage.write("media/p1/a.jpg", new ByteArrayInputStream(new byte[]{1}), 10);

        storage.delete("media/p1/a.jpg");

        assertThat(storage.sizeOf("media/p1/a.jpg")).isEmpty();
    }

    @Test
    void refusesAKeyThatEscapesTheRoot() {
        LocalMediaStorage storage = new LocalMediaStorage(dir);

        assertThatThrownBy(() ->
                storage.write("../outside.jpg", new ByteArrayInputStream(new byte[]{1}), 10))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void uploadUrlPointsAtTheLocalEndpoint() {
        UUID id = UUID.randomUUID();
        assertThat(new LocalMediaStorage(dir).uploadUrl(id, "media/p1/a.jpg", "image/jpeg", 123))
                .isEqualTo("/api/media/local/" + id);
    }
}
