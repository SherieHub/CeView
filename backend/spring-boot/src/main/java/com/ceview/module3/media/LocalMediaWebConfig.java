package com.ceview.module3.media;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;

/**
 * Local-dev only: exposes the upload directory at {@code /media/**}, mirroring
 * what CloudFront does in production. Keys are laid out as {@code media/<profile>/<id>.<ext>};
 * Spring resolves only the part of the URL after {@code /media/}, so the resource location
 * is the {@code media/} subdirectory of the storage root.
 */
@Configuration
@ConditionalOnProperty(name = "ceview.media.storage", havingValue = "local", matchIfMissing = true)
public class LocalMediaWebConfig implements WebMvcConfigurer {

    private final String location;

    public LocalMediaWebConfig(@Value("${ceview.media.local-dir:./media-uploads}") String dir) {
        String uri = Path.of(dir).toAbsolutePath().normalize().toUri().toString();
        // toUri() only adds the trailing slash when the directory already exists.
        this.location = (uri.endsWith("/") ? uri : uri + "/") + "media/";
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/media/**").addResourceLocations(location);
    }
}
