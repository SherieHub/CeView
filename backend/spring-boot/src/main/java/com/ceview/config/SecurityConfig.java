package com.ceview.config;

import com.ceview.auth.EmailVerificationFilter;
import com.ceview.auth.JwtAuthenticationFilter;
import com.ceview.auth.ProfileCompletionFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;

import java.util.Map;

@Configuration
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;
    private final EmailVerificationFilter emailVerificationFilter;
    private final ProfileCompletionFilter profileCompletionFilter;
    private final ObjectMapper objectMapper;
    private final CorsConfigurationSource corsConfigurationSource;
    private final boolean testSupportEnabled;

    public SecurityConfig(JwtAuthenticationFilter jwtFilter, EmailVerificationFilter emailVerificationFilter,
                           ProfileCompletionFilter profileCompletionFilter,
                           ObjectMapper objectMapper, CorsConfigurationSource corsConfigurationSource,
                           @Value("${ceview.test-support.enabled:false}") boolean testSupportEnabled) {
        this.jwtFilter = jwtFilter;
        this.emailVerificationFilter = emailVerificationFilter;
        this.profileCompletionFilter = profileCompletionFilter;
        this.objectMapper = objectMapper;
        this.corsConfigurationSource = corsConfigurationSource;
        this.testSupportEnabled = testSupportEnabled;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http.csrf(c -> c.disable())
            .cors(c -> c.configurationSource(corsConfigurationSource))
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> {
                // E2E-only hook that reads the last emailed verification code. The controller
                // behind it only exists when ceview.test-support.enabled=true; the property is
                // refused at startup in combination with a real email provider.
                if (testSupportEnabled) {
                    auth.requestMatchers("/api/test-support/**").permitAll();
                }
                auth
                // The ad-platform OAuth callback is a browser redirect from
                // Meta/TikTok — it carries no Authorization header, so tenancy
                // travels in a single-use state token instead (see AdOAuthState).
                .requestMatchers("/api/ad-connections/*/callback").permitAll()
                // Local-dev media (ceview.media.storage=local): the browser PUTs to a one-time
                // URL named by an unguessable media id, as with a presigned S3 URL, and reads
                // uploads back from /media/**. In production CloudFront serves /media/* from
                // S3 and neither route is reachable on the API.
                .requestMatchers(org.springframework.http.HttpMethod.PUT, "/api/media/local/*").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/media/**").permitAll()
                // The attribution redirect and the hosted enquiry form are hit
                // by a traveller who clicked an ad — a browser with no JWT and
                // no CeView account. Authenticating them is not possible, so
                // the slug carries the tenancy instead (which is why it is
                // random rather than derived, see SlugGenerator) and the
                // enquiry additionally requires a valid in-window click id.
                .requestMatchers("/r/**", "/api/public/attribution/**").permitAll()
                .requestMatchers("/api/auth/**", "/actuator/**", "/error").permitAll()
                .anyRequest().authenticated();
            })
            .exceptionHandling(e -> e.authenticationEntryPoint(authenticationEntryPoint()))
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            // Order matters: an unverified operator is told to verify before being told to
            // complete their profile.
            .addFilterAfter(emailVerificationFilter, JwtAuthenticationFilter.class)
            .addFilterAfter(profileCompletionFilter, EmailVerificationFilter.class);
        return http.build();
    }

    @Bean
    public AuthenticationEntryPoint authenticationEntryPoint() {
        return (request, response, authException) -> {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write(
                objectMapper.writeValueAsString(Map.of("error", "authentication required")));
            response.getWriter().flush();
        };
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
